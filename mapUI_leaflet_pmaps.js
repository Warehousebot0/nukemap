/* mapUI bindings for Leaflet and raster layers. */

mapUI_modes["raster-leaflet-protomaps"] = function(mapUI) {
	this.mapUI = mapUI;
	/* Arrays of files to load */
	this.css = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"];
	this.js = ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",staticAssets+"protomaps-leaflet.1.24.2min.js","https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"],
	this.plugins = [staticAssets+"Leaflet.greatCircle.js",staticAssets+"pmapl_json_style.js"];
	this.images = {} //image preloader 
	this.json = []; //json files
	this.keys = {}; //keys
	
	/* Load any additional settings from mapUI object */
	if(mapUI.options.css) this.css = [...this.css,...mapUI.options.css];
	if(mapUI.options.js) this.js = [...this.js,...mapUI.options.js];
	if(mapUI.options.images) this.images = {...this.images,...mapUI.options.images};
	if(mapUI.options.plugins) this.plugins = [...this.plugins,...mapUI.options.plugins];
	if(mapUI.options.json) this.json = [...this.json,...mapUI.options.json];
	if(mapUI.options.keys) this.keys = {...this.keys,...mapUI.options.keys};
	if(mapUI.options.baseLayers) this.baseLayers = mapUI.options.baseLayers;

	/* Translates any pos this script might return into an object of {lat, lon}. 
	 * Most of this should work with any EXCEPT those which use [lon,lat] as reversed
	 * arrays. Note that any user inputted coordinates should be in the form of [lat,lon]. 
	 */ 
	this.latLon = function(pos) {
		if(typeof pos.lat != "undefined") {
			if(typeof pos.lng != "undefined") return {lat:+pos.lat,lon:+pos.lng};
			if(typeof pos.lon != "undefined") return {lat:+pos.lat,lon:+pos.lon};			
			if(DEBUG) console.log(`Invalid latLon object input`,pos);
			return false;
		} else if(Array.isArray(pos)) {
			if(pos.length==2) {
				return {lat:+pos[0],lon:+pos[1]};
			} else {
				if(DEBUG) console.log(`Invalid latLon array input`,pos);
			}
		} else if(typeof pos=="string" && pos.indexOf(",")>-1) {
			let ll = pos.split(",");
			return {lat:+ll[0],lon:+ll[1]};
		} else {
			if(DEBUG) console.log(`Invalid latLon input`,pos);
			return false; //unknown/invalid
		}
	};

	/* Translates the results of latLon above into whatever internal
	 * position variable needed by this library.
	 */
	this.ll = (latLon) => { return L.latLng(latLon.lat,latLon.lon); };

	/* 
	* Creates the map object. Note that this is done before 
	* load, because we want to make sure that we can set the onload
	* event for the map before we load it, and that is not always 
	* possible in some frameworks.
	*/
	this.loadMap = (mapOptions,onLoad,onError)=> {
		if(DEBUG) console.log("mapUI.rasterleafletpmap loadMap",mapOptions);
		mapOptions = this.mapOptions(mapOptions);
		this.baseLayersTileLayers = {};
		if(typeof this.baseLayers == "function") {
			var baseLayers = this.baseLayers();
		} else {
			var baseLayers = this.baserLayers;
		}

		var map = L.map(mapOptions.div,mapOptions)
		.on('load', () => {
			if(DEBUG) console.log("map.on('load')");
			map.do_onload = true;
			if(typeof this.mapUI.options.onmapload == "function") {
				this.mapUI.options.onmapload.call(this);
			}
		})
		.on('baselayerchange',(e)=> {
			if(DEBUG) console.log("map.on('baselayerchange'",e);
			if(typeof this.mapUI.options.onbaselayerchangedone == "function") {
				this.mapUI.options.onbaselayerchangedone.call(this,e);
			}
		})
		
		var defaultLayer;
		for(var i in Object.keys(baseLayers)) {
			var key = Object.keys(baseLayers)[i];
			if(baseLayers[key].default) defaultLayer = key;
			//console.log(key,baseLayers[key]);
			for(var z in baseLayers[key].layers) {
				var layer = baseLayers[key].layers[z];
				if(layer.type=="protomapsL") {
					var l = {
						tileLayer: protomapsL.leafletLayer(layer.style),
						type: layer.type,
						attribution: layer.attribution,
						provider: layer.provider,
						sourcekey: layer.sourcekey,
						wordmark: layer.wordmark,
					}
				} else {
					var l = {
						tileLayer: L.tileLayer(layer.url,{
							attribution: layer.attribution,
							minZoom: layer.minZoom,
							maxZoom: layer.maxZoom
						}),
						attribution: layer.attribution,
						minZoom: layer.minZoom,
						maxZoom: layer.maxZoom
					}	
				}
				l.tileLayer._obj = l;
				l.tileLayer.on("tileload",(e)=> {
					if(typeof this.mapUI.options.ontileload == "function") {
						this.mapUI.options.ontileload.call(this,e);
					}
				})
				l.tileLayer.on("tileloadstart",(e)=> {
					if(typeof this.mapUI.options.ontileloadstart == "function") {
						this.mapUI.options.ontileloadstart.call(this,e);
					}
				})
				if(baseLayers[key].layers.length>1) {
					if(!this.baseLayersTileLayers[key]) this.baseLayersTileLayers[key] = [];
					this.baseLayersTileLayers[key].push(l);
				} else {
					this.baseLayersTileLayers[key] = l;
				}
			}
		}
		if(!defaultLayer) defaultLayer = Object.keys(baseLayers)[0];
		//console.log(this.baseLayersTileLayers);

		this.showLayer(defaultLayer,map);

		map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>')
		map._eventid = "map_"+this.mapUI.randomKey();
		map.id = "map";
		if(DEBUG) console.log("map initalized",map);
		map.setView(this.latLon(mapOptions.position), mapOptions.zoom);

		return map;
	};

	this.showLayer = (layerId,map) => {
		if(!map) map = MAPUI.map._map;
		var attr = "";
		for(var i in Object.keys(this.baseLayersTileLayers)) {
			var key = Object.keys(this.baseLayersTileLayers)[i];
			if(Array.isArray(this.baseLayersTileLayers[key])) {
				for(var x in this.baseLayersTileLayers[key]) {
					if(layerId==key) {
						this.baseLayersTileLayers[key][x].tileLayer.addTo(map);
					} else {
						map.removeLayer(this.baseLayersTileLayers[key][x].tileLayer);
					}
				}
			} else {
				if(layerId==key) {
					this.baseLayersTileLayers[key].tileLayer.addTo(map);
				} else {
					map.removeLayer(this.baseLayersTileLayers[key].tileLayer);
				}
			}
		}
		
	}

	/* Translates mapOptions */
	this.mapOptions = (mapOptions) => {
		if(mapOptions.container) mapOptions.div = mapOptions.container;
		if(mapOptions.div == undefined) mapOptions.div = "map";
		return mapOptions;
	}

	/* MAP FUNCTIONS */

	this._map = (map)=>{ return map._map==undefined?map:map._map }

	/* Returns the latLon for the center of the map in its current view */
	this.getCenter = (map)=> { return this.latLon(this._map(map).getCenter()) }

	/* Sets the center of the map to latlon */
	this.panTo = (map,latLon) => { this._map(map).panTo(latLon) }

	/* Combines moving and zooming in on operation */
	this.setView = (map, latLon, zoom) => {
		this._map(map).setView(latLon,zoom) 
	}

	/* Returns the current zoom level of the map */
	this.getZoom = (map) => { return this._map(map).getZoom() }

	/* Sets the current zoom level of the map */
	this.zoomTo = (map,zoom) => { this._map(map).setZoom(zoom) }

	/* Resizes map to bounds. Bounds can be either [latLon,latLon] or it
	 * can be {sw:latLon, ne:latLon}. Padding in this case is a pixel amount from edge.
	 */
	this.fitBounds = (map,bounds,padding=0) => {
		//padding is done at the map initialization level for leaflet
		this._map(map).fitBounds(this.bounds(bounds));
	}

	/* Creates a Bounds object that can be used internally. Input can either be an array of [[lat,lon],[lat,lon]] or an object of {sw:latLon, ne:latLon} */
	this.bounds = (bounds) => {
		if(Array.isArray(bounds)) {
			var sw = this.latLon(bounds[0]);
			var ne = this.latLon(bounds[1]);
		} else {
			var sw = this.latLon(bounds.sw);
			var ne = this.latLon(bounds.ne);
		}
		return [[sw.lat,sw.lon],[ne.lat,ne.lon]]
	}

	/* CIRCLES */

	/* Create new circle object */
	this.circle = (circleOptions,obj) => {
		circleOptions = this.circleOptions(circleOptions);
		if(circleOptions.pane==undefined) {
			circleOptions.pane = "circlePane";
			circleOptions.paneIndex = 400;
		}
		if(typeof mapUI.map._map.getPane(circleOptions.pane) == "undefined") {
			mapUI.map._map.createPane(circleOptions.pane);
			mapUI.map._map.getPane(circleOptions.pane).style.zIndex = circleOptions.paneIndex;
		}
		let circle = new L.GreatCircle(this.ll(this.latLon(circleOptions.position)),circleOptions);
		circle.obj = obj;
		circle._eventid = "circle_"+this.mapUI.randomKey(); //for event handling
		circle.addTo(circleOptions.map?circleOptions.map:mapUI.map._map);
		if(typeof circleOptions.boundObject != "undefined") {
			if(typeof circleOptions.boundObject.bindings == "undefined") circleOptions.boundObject.bindings = [];
			circleOptions.boundObject.bindings.push(circle);
			circle.bound = true;
		}
		return circle;
	}

	/* Translate to standardized circle options. Using Leaflet as our "default" specification. */
	this.circleOptions = (circleOptions) => {
		if(circleOptions.map) circleOptions.map = circleOptions.map._map;
		return circleOptions;
	}

	/* Remove a circle */
	this.circleRemove = (circle) => { circle.remove(); };

	/* Center LatLon of a circle */
	this.circleGetLatLon = (circle,obj) => { return this.latLon(circle.getLatLng()) };
	this.circleSetLatLon = (circle,latLon,obj) => { circle.setLatLng(this.ll(latLon)) }

	/* Radius of a circle */
	this.circleGetRadius = (circle,obj) => { return circle.getRadius(); };
	this.circleSetRadius = (circle,radius,obj) => { circle.setRadius(radius) }

	/* Circle options updater */
	this.circleSetOptions = (circle,circleOptions,obj) => {
		circleOptions = this.circleOptions(circleOptions);
		circle.setStyle(circleOptions);
		if(circleOptions.radius) this.circleSetRadius(circle,circleOptions.radius,obj);
		if(circleOptions.position) this.circleSetLatLon(circle,circleOptions.position,obj);
	}
	/* Get circle property */
	this.circleGetProperty = (circle,property,obj) => {
		if(property=="radius") return circle.getRadius();
		if(circle[property]) return circle[property];
		if(circle.options && circle.options[property]) return circle.options[property];
		if(circle._options && circle._options[property]) return circle._options[property];
		return undefined;
	}

	/* Circle bounds */
	this.circleGetBounds = (circle,obj) => { 
		var b = circle.getBounds(); 
		return {sw: this.latLon(b._southWest),ne:this.latLon(b._northEast)
		} 
	}

	/* MARKERS */

	/* Create new marker object */
	this.marker = (markerOptions) => { 
		markerOptions.id = typeof markerOptions.id=="undefined"?"marker":markerOptions.id;
		markerOptions = this.markerOptions(markerOptions);

		if(markerOptions.shadow) {
			var markerShadow = this.mapUI.marker(markerOptions.shadow);
			markerShadow.is_shadow = true;
		}
		//useful for debugging anchor
		//let t = L.marker(markerOptions.position).addTo(markerOptions.map?markerOptions:this.mapUI.map._map);

		let marker = L.marker(markerOptions.position,markerOptions).addTo(markerOptions.map?markerOptions:this.mapUI.map._map); 

		$(marker.getElement()).attr("id",markerOptions.id);

		//aligns the image and the div -- needed because div is what is getting click events. if they are
		//off then it is deceptive where to click to drag if the icon is significantly offset from origin
		$("#"+markerOptions.id+" img").css("margin-left","0px");
		$("#"+markerOptions.id+" img").css("margin-top","0px");

		marker.bindings = [];

		marker._eventid = "marker_"+this.mapUI.randomKey(); //for event handling
		marker.id = markerOptions.id;

		if(markerOptions.animation == "drop") {
			var markerIcon = $(marker._icon);
			var transformMatrix = $(markerIcon).css("transform");
			var matrix = transformMatrix.replace(/[^0-9\-.,]/g, '').split(',');
			var x = matrix[12] || matrix[4];//translate x
			var y = matrix[13] || matrix[5];//translate y
			//bounce marker
			$(markerIcon).css({"top":-y+"px"});
			$(markerIcon).animate({
				top: 0,
			},{ 
				duration: 1000, 
				easing: "easeOutBounce"
			});	
		}

		if(markerShadow) {
			return {marker: marker, shadow: markerShadow};
		} else {
			return marker;
		}
	}

	/* Translate to standardized marker options. Using Leaflet as our "default" specification. */
	this.markerOptions = (markerOptions) => {
		var o = {
			id: markerOptions.id,
			position: this.ll(this.latLon(markerOptions.position)),
			draggable: markerOptions.draggable==undefined?false:markerOptions.draggable,
			autopan: markerOptions.autopan==undefined?false:markerOptions.autopan,
			title: markerOptions.title==undefined?undefined:markerOptions.title,
			animation: markerOptions.animation==undefined?undefined:markerOptions.animation
		}	
		if(markerOptions.icon) {
			var icon = markerOptions.icon;
			if(markerOptions.className && !markerOptions.icon.className) icon.className = markerOptions.className;
			if(icon.iconSize && icon.iconAnchor) {
				/* The way anchor offsets are currently handled is how Maplibre does it,
				 * which is not exactly the same as Leaflet — different assumptions about the origin
				 * point or something. This seems to work? */
				icon.iconAnchor[0]=(icon.iconSize[0]/2)-(icon.iconAnchor[0]/2);
				icon.iconAnchor[1]=(icon.iconSize[1]/2)+(icon.iconAnchor[1]);
			}		
			/* Leaflet prefers to use plain img objects as markers, which 
			 * creates all sorts of issues with their placement, rotation, scaling, etc.
			 * So what the below does is wrap the marker img in a div. Leaflet will still apply 
			 * things like the offsets to the marker img, so we will need to remove those later, after
			 * the marker has been created. This more or less makes it the same as Maplibre. */
			var imgIcon = L.icon({
				iconUrl: icon.iconUrl,
				iconSize: icon.iconSize,
				className: markerOptions.className
			}).createIcon();
			var divIcon = L.divIcon({
				className: markerOptions.className?markerOptions.className:"div-icon",
				iconSize: icon.iconSize,
				iconAnchor: icon.iconAnchor,
				html:$(imgIcon).prop("outerHTML")
			})

			o.icon = divIcon;
		}	


		if(markerOptions.shadow) {
			o.shadow = {
				id: markerOptions.shadow.id?markerOptions.shadow.id:o.id+"_shadow",
				className: markerOptions.shadow.className==undefined?undefined:markerOptions.shadow.className,
				position: o.position,
				icon: markerOptions.shadow,
			}
		}
		return o;
	}

	/* Remove a marker */
	this.markerRemove = (marker) => { this.mapUI.map._map.removeLayer(marker) };

	/* latLon of a marker */
	this.markerGetLatLon = (marker) => { return this.latLon(marker.getLatLng()) }
	this.markerSetLatLon = (marker, latLon) => { marker.setLatLng(this.ll(latLon)) }

	/* Retrieves a link to the icon property of the marker */
	this.markerGetIcon = (marker) => { 
		return marker.getElement();
	}
	/* Changes the icon base image */
	/* This basically just swaps attributes... this potentially could create issues if the 
	 * new icon is not the same size as the old one. */
	this.markerSetIcon = (marker,markerIcon) => {
		var id = $(marker.getElement()).attr("id");
		var id2 = $(markerIcon).attr("id");
		$("#"+id+" img").attr("src",$("#"+id2+" img").attr("src"));
		$("#"+id).css("margin-left",$(markerIcon).css("margin-left"));
		$("#"+id).css("margin-top",$(markerIcon).css("margin-top"));
		$("#"+id+" img").css("width",$(markerIcon).css("width"));
		$("#"+id+" img").css("height",$(markerIcon).css("height"));
		$("#"+id).css("width",$(markerIcon).css("width"));
		$("#"+id).css("height",$(markerIcon).css("height"));
	}
	
	/* Gets or sets the hover title of the marker */
	this.markerSetTitle = (marker,title) => {
		$("#"+marker.id).prop("title",title);
	}
	this.markerGetTitle = (marker) => {
		return $("#"+marker.id).prop("title");
	}
	
	/* Should set the property to value when value is not undefined, otherwise return existing value. Basically a crude version of how JQuery does it. */
	this.markerCSS =(marker, property, value) => {
		if(value==undefined) {
			return $("#"+marker.id+" img").css(property);
		} else {
			return $("#"+marker.id+" img").css(property,value);
		}
	}
	
	/* POLYGON */
	this.polygon = (polygonOptions) => { 
		polygonOptions = this.polygonOptions(polygonOptions);
		let polygon = L.polygon(this.mapUI.lls(polygonOptions.latLons),polygonOptions).addTo(polygonOptions.map?polygonOptions.map:this.mapUI.map._map); 
		polygon._eventid = "polygon_"+this.mapUI.randomKey(); //for event handling
		return polygon;
	}

	/* Translates settings from Leaflet polygon to whatever else. */
	this.polygonOptions = (polygonOptions) => {
		if(polygonOptions.latLngs) polygonOptions.latLons = this.mapUI.latLons(polygonOptions.latLngs)
		if(polygonOptions.latLons) polygonOptions.latLons = this.mapUI.latLons(polygonOptions.latLons)
		if(polygonOptions.dashArray) polygonOptions.dashArray = polygonOptions.dashArray.toString();
		if(polygonOptions.map) polygonOptions.map = polygonOptions.map._map;
		return polygonOptions;
	}

	/* Remove a polygon */
	this.polygonRemove = (polygon) => { this.mapUI.map._map.removeLayer(polygon) };

	/* latLon of polygon centroid */
	this.polygonGetCenter = (polygon) => { return this.latLon(polygon.getCenter()) }
	
	/* Get latLons of polygon positions */
	this.polygonGetLatLons = (polygon,obj) => {
		return this.mapUI.latLons(polygon.getLatLngs());
	}

	/* Replaces all positions of polygon with new ones. */
	this.polygonSetLatLons = (polygon,latLons,obj) => {
		polygon.setLatLngs(this.mapUI.lls(this.mapUI.latLons(latLons)));
	}

	/* Add a single latLon to polygon */
	this.polygonAddLatLon = (polygon, latLon, obj) => { polygon.addLatLng(this.ll(latLon)) }
	
	/* Returns true if the polygon has no points */
	this.polygonIsEmpty = (polygon, obj) => { return polygon.isEmpty() }

	/* Returns polygon bounds */
	this.polygonGetBounds = (polygon, obj) => { return polygon.getBounds() }

	/* Get polygon property */
	this.polygonGetProperty = (polygon,property,obj) => {
		if(polygon[property]) return polygon[property];
		if(polygon.options && polygon.options[property]) return polygon.options[property];
		if(polygon._options && polygon._options[property]) return polygon._options[property];
		return undefined;
	}

	/* Sets the options of the polygon again */
	this.polygonSetOptions = (polygon, polygonOptions, obj) => {
		polygonOptions = this.polygonOptions(polygonOptions);
		if(polygonOptions.latLons) {
			this.polygonSetLatLons(polygonOptions.latLons)
		}
		polygon.setStyle(polygonOptions);
	}

	/* EVENT HANDLERS */

	/* The main handler is in the parent library; these are the low-level implementations. */
	this.eventOn = (subject,event_name,event_function,object) => {
		return subject.on(event_name,event_function);
	}
	this.eventOff = (subject,event_name,event_function,object) => {
		return subject.off(event_name,event_function);
	}

	/* This is what would convert between Leaflet's event handler names and 
	 * this library's. If we return just a single string, it will assume
	 * that this is the name of the event. If we return false, it will 
	 * skip any event handling for this event. If we return an object and a 
	 * string in an array, it will use the object as the new subject.
	*/
	this.translateEvent = (subject,event) => {
		return event;
	}

	/* CONTROLS */

	//have to have our own for this...
	this.addLayerControl = (options,obj) => {
		var map = this.mapUI.map._map;
		var layers = this.mapUI.baseLayers();
		console.log("addLayerControl",layers);
		var lc = {};
		lc.map = map;
		lc.options = options;
		lc.baseLayers = layers;
		var map_container = lc.map._container;
		//want to make it so that if the layer length is just 1, and there are
		//no mapchecks, it doesn't render the control. but not a high priority.

		if(!$(".leaflet-control-container").length) {
			var control_container = document.createElement("div");
			$(control_container).addClass("leaflet-control-container");
			var cc = document.createElement("div");
			$(cc).addClass("leaflet-top").addClass("leaflet-left").prop("id","leaflet-topleft");
			$(cc).appendTo(control_container);
			var cc = document.createElement("div");
			$(cc).addClass("leaflet-top").addClass("leaflet-right").prop("id","leaflet-topright");
			$(cc).appendTo(control_container);
			var cc = document.createElement("div");
			$(cc).addClass("leaflet-bottom").addClass("leaflet-left").prop("id","leaflet-bottomleft");
			$(cc).appendTo(control_container);
			var cc = document.createElement("div");
			$(cc).addClass("leaflet-bottom").addClass("leaflet-right").prop("id","leaflet-bottomright");
			$(cc).appendTo(control_container);
			$(control_container).appendTo(map_container);
		}
		$("div.leaflet-left.leaflet-top").prop("id","leaflet-topleft");
		$("div.leaflet-right.leaflet-top").prop("id","leaflet-topright");
		$("div.leaflet-left.leaflet-bottom").prop("id","leaflet-bottomleft");
		$("div.leaflet-right.leaflet-bottom").prop("id","leaflet-bottomright");
			
		var control_div = document.createElement("div");
		$(control_div).addClass("leaflet-control-layers")
		$(control_div).addClass("leaflet-control");
		var layer_button = document.createElement("a");
		$(layer_button).prop("href","#");
		$(layer_button).prop("title","Layers");
		$(layer_button).addClass("leaflet-control-layers-toggle");
		$(layer_button).appendTo($(control_div));
		var section = document.createElement("section");
		$(section).addClass("leaflet-control-layers-list");
		if(Object.keys(lc.baseLayers.length)>0) {
			var base_div = document.createElement("div");
			$(base_div).addClass("leaflet-control-layers-base");
			for(var i in Object.keys(lc.baseLayers)) {
				var key = Object.keys(lc.baseLayers)[i];
				var layer = lc.baseLayers[key];
				var layerLabel = document.createElement("label");
				var layerSpan = document.createElement("span");
				var layerRadio = document.createElement("input");
				$(layerRadio).prop("type","radio");
				$(layerRadio).prop("i",i);
				$(layerRadio).addClass("leaflet-control-layers-selector");
				if(layer.selected) {
					$(layerRadio).prop("checked",layer.selected);
					lc.baseLayer = i;
				}
				$(layerRadio).prop("name","leaflet-base-layers_"+lc.options.id_no);
				$(layerRadio).appendTo(layerSpan);
				$(layerRadio).on("click",function() {
					/*var sel = $(this).prop("i");
					if(lc.baseLayer != sel) {
						var oldBaseLayer = lc.baseLayer;
						if(typeof lc.options.beforebaselayerchange == "function") {
							lc.options.beforebaselayerchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer)
						}
						lc.baseLayer = sel;
						if(!lc.options.overrideDefaultEvents) {
							this.showLayer(key);
							map.setStyle(lc.baseLayers[sel].style);
						}
						if(typeof lc.baseLayers[sel].onchange == "function") {
							lc.baseLayers[sel].onchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer)
						}
						if(typeof lc.options.onbaselayerchange == "function") {
							lc.options.onbaselayerchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer);
						}
					}*/
				})
				var layerNameSpan = document.createElement("span");
				$(layerNameSpan).text(layer.name);
				$(layerNameSpan).appendTo(layerSpan);
				$(layerSpan).appendTo(layerLabel);
				$(layerLabel).appendTo(base_div);
				if(layer.hover) $(layerLabel).prop("title",option.hover);
			}
			$(base_div).appendTo($(section));
		}
		$(section).appendTo(control_div);
		$(control_div).appendTo($("#leaflet-"+lc.options.position));		

		/* these don't seem to fire -- need to make this work better on touch and not just always click radio automatically */
		$(layer_button).on("touch",function(e) {
			$(control_div).addClass("leaflet-control-layers-expanded");
		})			
		$(layer_button).on("click",function(e) {
			$(control_div).addClass("leaflet-control-layers-expanded");
		})

		$(layer_button).on("mouseover",function(e) {
			$(control_div).addClass("leaflet-control-layers-expanded");
		})
		$(control_div).on("mouseleave",function() {
			$(control_div).removeClass("leaflet-control-layers-expanded");
		})
		this.layerControl = lc;
	}
	this.addZoomControl = (options, obj) => {
		this.zoomControl = L.control.zoom(options).addTo(this.mapUI.map._map);
	}
	this.addScaleControl = (options, obj) => {
		if(options.units==1) {
			options.imperial = true;
			options.metric = false;
		} else {
			options.imperial = false;
			options.metric = true;
		}
		this.scaleControl = L.control.scale(options).addTo(this.mapUI.map._map);
	}


	/* MISC */

	/* Convert a pixel location on the map DIV (px,py) to lat/lon */
	this.pixelToLatLon = (px,py) => {
		return this.mapUI.map.containerPointToLatLng([px,py]);
	};


	this._interpolate_number = (z,method,z1,v1,z2,v2) => {
		if(method[0]=="linear") {
			var ret = lerp(v1,z1,v2,z2,z);
		} else if (method[0]=="exponential") {
			var ret = xerp(v1,method[1],z1,v2,z2,z);
		}
		if(ret>v2) ret=v2;
		if(ret<v1) ret=v1;
		return ret;
	}
	this._base = (z,base,stops)=>{
		//console.log(z,base,stops);
		return 1;
	}

	this._interpolate_color_hsl = (z,method,z1,v1,z2,v2) => {
		var c1 = ((v1.replaceAll("hsl(","")).replaceAll(")","")).split(",");
		var c2 = ((v2.replaceAll("hsl(","")).replaceAll(")","")).split(",");
		var h1 = +c1[0];
		var h2 = +c2[0];
		var s1 = +(c1[1].replaceAll("%",""));
		var s2 = +(c2[1].replaceAll("%",""));
		var l1 = +(c1[2].replaceAll("%",""));
		var l2 = +(c2[2].replaceAll("%",""));
		if(method[0]=="linear") {
			var h3 = lerp(h1,z1,h2,z2,z);
			var s3 = lerp(s1,z1,s2,z2,z);
			var l3 = lerp(l1,z1,l2,z2,z);
		} else if (method[0]=="exponential") {
			var h3 = lerp(h1,z1,h2,z2,z);
			var s3 = lerp(s1,z1,s2,z2,z);
			var l3 = lerp(l1,z1,l2,z2,z);
		}
		if(h3>h1) h3=h1;
		if(h3<h2) h3=h2;
		if(s3>s1) s3=s1;
		if(s3<s2) s3=s2;
		if(l3>l1) l3=l1;
		if(l3<l2) l3=l2;
		return `hsl(${h3},${s3}%,${l3}%)`;
	}

	this.mVal = (z,f,val)=> {
		if(Array.isArray(val)) {
			switch(val[0]) {
				case "interpolate":
					if(val[2][0] == "zoom") {
						var z1 = val[3];
						var v1 = val[4];
						var z2 = val[5];
						var v2 = val[6];
						if(+v1 === v1) { //number
							var ret = lerp(v1,z1,v2,z2,z);
							if(ret>v2) ret=v2;
							if(ret<v1) ret=v1;
							ret = ret/10;
						}
					}
				break;
				default: 
					console.log(val[0],val);
					var ret = 0.5;
				break;
			}
		} else {
			//console.log(val);
		}
		//if(Math.random()<0.01) console.log(z,f,val,ret);
		return ret;
	}


	return this;
}

//add easeOutBounce easing to jQuery defaults
jQuery.extend(jQuery.easing, {
	easeOutBounce: function (x, t, b, c, d) {
	if ((t/=d) < (1/2.75)) {
			return c*(7.5625*t*t) + b;
	} else if (t < (2/2.75)) {
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
	} else if (t < (2.5/2.75)) {
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
	} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
	}
	},
})
