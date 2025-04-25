/* mapUI bindings for MapLibre GL and vector layers */

var mGL; //global to hold custom library functions for polygons and circles

mapUI_modes["vector-maplibre"] = function(mapUI) {
	this.mapUI = mapUI;
	if(DEBUG) console.log("mapUI:vector-maplibre");

	/* Arrays of files to load */
	this.css = ["https://unpkg.com/leaflet@1.9.3/dist/leaflet.css","https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css"];
	this.js = ["https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js",staticAssets+"mGL.js"];

	this.images = {}; //static image files to preload 
	this.plugins = []; //JS scripts that run after all other JS scripts are loaded
	this.json = []; //JSON files to load -- needs to be an object of {id,url,onload}, and will populate this._json[id] with {data,url}

	/* Key storage that can be populated by other scripts */
	this.keys = {};

	/* Load any additional settings from mapUI object */
	if(mapUI.options.css) this.css = [...this.css,...mapUI.options.css];
	if(mapUI.options.js) this.js = [...this.js,...mapUI.options.js];
	if(mapUI.options.images) this.images = {...this.images,...mapUI.options.images};
	if(mapUI.options.plugins) this.plugins = [...this.plugins,...mapUI.options.plugins];
	if(mapUI.options.json) this.json = [...this.json,...mapUI.options.json];
	if(mapUI.options.keys) this.keys = {...this.keys,...mapUI.options.keys};
	if(mapUI.options.baseLayers) this.baseLayers = mapUI.options.baseLayers;

	/* Runs after all of the above files have loaded but before map is loaded.
	 * If set, needs to call onready() when done. Should be only callable once.
	 */
	this.onreadyCalled = false;
	this.onready = (onready) => {
		/*
		console.log("Setting up protocol");
		this.protocol = new pmtiles.Protocol();
		maplibregl.addProtocol("pmtiles",this.protocol.tile);
		let PMTILES_URL = "https://maps.nukemaps.com/20231025.pmtiles";
		const p = new pmtiles.PMTiles(PMTILES_URL);
		this.protocol.add(p);
		console.log("Protocol added",pmtiles,maplibregl);
		*/

		if(DEBUG) console.log("onready");
		var j = [];
		for(var i in vectorLayers) {
			if(vectorLayers[i].json!=undefined) {
				if(vectorLayers[i].load == undefined || (typeof vectorLayers[i].load == "function" && vectorLayers[i].load() == true) || vectorLayers[i].load==true) {
					j.push({id:vectorLayers[i].json.id,url:vectorLayers[i].json.url,onload:vectorLayers[i].json.onload,nowait:vectorLayers[i].json.nowait});
				}
			}
		}
		if(j.length>0) {
			var loaded = 0;
			for(var i in j) {
				if(j[i].nowait) loaded++;
			}
			if(loaded>=j.length) {
				if(typeof onready=="function" && this.onreadyCalled == false) {
					this.onreadyCalled = true; 
					onready.call(this.mapUI,this.mapUI,this);
				}
			}
			this.mapUI.loadJSON(j,()=>{
				loaded++;
				if(loaded>=j.length) {
					if(typeof onready=="function" && this.onreadyCalled == false) {
						onready.call(this.mapUI,this.mapUI,this);
						this.onreadyCalled = true; 
					}
				}
			});
		} else {
			if(typeof onready=="function" && this.onreadyCalled == false) {
				onready.call(this.mapUI,this.mapUI,this);
				this.onreadyCalled = true; 
			}
		}
	}
	
	/* Translates any pos this script might return into an object of {lat, lon}. 
	 * Most of this should work with any EXCEPT those which use [lon,lat] as reversed
	 * arrays. Note that any user inputted coordinates should be in the form of [lat,lon].
	 * Func is an optional pre-processor.
	 */ 
	this.latLon = function(pos,func) {
		if(typeof func =="function") pos = func(pos);
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
	this.ll = (latLon) => { return {lat:latLon.lat,lng:latLon.lon } };

	/* 
	 * Creates and returns the map object. Note that it will need to call onLoad once
	 * the map is actually loaded and ready for use. onError is a way to register an error.
 	 */
	this.loadMap = (mapOptions,onLoad,onError)=> {
		if(DEBUG) console.log("mapUI.maplibre loadMap",mapOptions);
		mapOptions = this.mapOptions(mapOptions);
		this.baseLayersTileLayers = {};
		if(typeof this.baseLayers == "function") {
			this.baseLayers = this.baseLayers();
		}

		for(var i in Object.keys(this.baseLayers)) {
			var key = Object.keys(this.baseLayers)[i];
			if(this.baseLayers[key].default) this.defaultLayer = key;
		}
		if(this.defaultLayer==undefined) this.defaultLayer = 0;
		this.baseLayers[this.defaultLayer].selected = true;
	
		var map = new maplibregl.Map({
			container: mapOptions.container,
			center: mapOptions.center,
			style: this.baseLayers[this.defaultLayer].style,
			zoom: mapOptions.zoom,
			projection: mapOptions.projection,
			dragRotate: mapOptions.dragRotate,
			pitchWithRotate: mapOptions.pitchWithRotate,
			touchPitch: mapOptions.touchPitch,
			maplibreLogo: true,
			collectResourceTiming: true,
			transformRequest: (url,resourceType)=> {
				/* Every remote URL request passes through this function, and so we can
				 * add our own custom URL tags, etc., that way. 
				 */
				if(resourceType=="Tile" && Object.keys(this.keys).length>0 && url.indexOf("{key}")>-1) {
					for(var i in this.keys) {
						if(url.indexOf(this.keys[i].search)>-1) {
							return {url: url.replace("{key}",this.keys[i].key)};
						}
					}
				} 
			}
		})
		if(!mapOptions.dragRotate) map.touchZoomRotate.disableRotation();
		
		if(mapOptions.padding) map.padding = mapOptions.padding;

		map._eventid = "map_"+this.mapUI.randomKey();
		map.id = "map";

		/* Fires after source data is loaded (cf. sourcedataloading, which fires before).
		 * This is part of the tile counting/tracking -- determines which tiles are downloaded
		 * and which are delivered from cache, depending on how long it takes for them to have 
		 * downloaded. Requires resourceTiming to be turned on to get real duration of resources.
		 * Adds the tracking info to a queue that is cleared every few seconds to avoid spamming
		 * the server.
		 */
		map.on("sourcedata",(e)=>{
			if(typeof mapUI.options.ontileload=="function") {
				mapUI.options.ontileload.call(this,e);
			}
		})
		
		//the maplibregl/mapboxgl UI elements library
		mGL = new mGL_ui(map);
		this.mGL = mGL;

		map.on('error', (e,a) => {
			if(DEBUG) console.error("map.on('error')",e.error.message,e.error.stack,e);
			map_error = e.error;
		})

		//should trigger when map loads...
		//trying with render... should load a little faster and more reliably?
		map.once('render', () => {
			if(DEBUG) console.log("map.on('load')");
			if(typeof this.mapUI.options.onmapload == "function") {
				this.mapUI.options.onmapload.call(this);
			}
			if(typeof onLoad == "function") {
				onLoad.call(this,map);
			}	
			if(DEBUG) console.log("map loaded",map);
		})

		map.on('styleimagemissing',(e)=> {
			if(DEBUG) console.log("map.on('styleimagemissing')",e.id,e);
			if(typeof this.mapUI.options.onstyleimagemissing == "function") {
				this.mapUI.options.onstyleimagemissing.call(this,e);
			}
		})
	
		map.on('dataabort',(e)=> {
			if(DEBUG) console.log("map.on('dataabort')",e.sourceId,e.coord.canonical,e);
			if(typeof this.mapUI.options.ondataabort == "function") {
				this.mapUI.options.ondataabort.call(this,e);
			}
		})
	
		if(DEBUG) console.log("map object created",map);
		return map;
	}


	/* Translates mapOptions */
	this.mapOptions = (mapOptions) => {
		var defaults = {
			div: "map",
			container: mapOptions.div?mapOptions.div:"map",
			center: mapOptions.position?mapOptions.position:[0,0],
			projection: "mercator",
			dragRotate: false,
			pitchWithRotate: false,
			touchPitch: false,
			padding: mapOptions.padding
		}
		return {...defaults,...mapOptions}
	}


	/* MAP FUNCTIONS */

	this._map = (map)=>{ return map._map==undefined?map:map._map }

	/* Returns the latLon for the center of the map in its current view */
	this.getCenter = (map)=> { return this.latLon(this._map(map).getCenter()) }

	/* Sets the center of the map to latlon */
	this.panTo = (map,latLon,animate) => { 
		if(animate==false) {
			this._map(map).panTo(latLon,{animate:false})
		 } else {
			this._map(map).panTo(latLon)
		 }	 
	}

	/* Combines moving and zooming in on operation */
	this.setView = (map, latLon, zoom) => {
		this._map(map).panTo(latLon,false);//,{"animate":false});
		this._map(map).zoomTo(zoom,false);//,{"animate":false});
	}

	/* Returns the current zoom level of the map */
	this.getZoom = (map) => { return this._map(map).getZoom() }

	/* Sets the current zoom level of the map */
	this.zoomTo = (map,zoom,animate) => { 
		if(animate==false) {
			this._map(map).setZoom(zoom,{animate:false}) 
		} else {
			this._map(map).setZoom(zoom) 
		}
	}

	/* Resizes map to bounds. Bounds can be either [latLon,latLon] or it
	 * can be {sw:latLon, ne:latLon}. Padding in this case is a pixel amount from edge.
	 */
	this.fitBounds = (map,bounds) => {
		this._map(map).fitBounds(this.bounds(bounds),{padding:this._map(map).padding?this._map(map).padding:0});
	}

	/* Creates a Bounds object that can be used internally. Input can either be an array of [[lat,lon],[lat,lon]] or an object of {sw:latLon, ne:latLon} */
	/* Note that because of how this works, you should NOT call this before passing it to fitBounds, because
	 * the below outputs lon/lat (as maplibre wants) and if you pre-run it that way it will get reversed again. */
	this.bounds = (bounds) => {
		if(Array.isArray(bounds)) {
			var sw = this.latLon(bounds[0]); 
			var ne = this.latLon(bounds[1]);
		} else {
			var sw = this.latLon(bounds.sw);
			var ne = this.latLon(bounds.ne);
		}
		return [[sw.lon,sw.lat],[ne.lon,ne.lat]] //lon/lat!
	}

	/* CIRCLES */

	/* Create new circle object */
	this.circle = (circleOptions) => {
		circleOptions = this.circleOptions(circleOptions);
		var pos = this.mapUI.latLon(circleOptions.position);
		let circ = mGL.circle([pos.lat,pos.lon], circleOptions);
		circ._eventid = "circle_"+this.mapUI.randomKey() //for event handling
		return circ;
	}

	/* Translate to standardized circle options. Using Leaflet as our "default" specification so we need to translate a few things. */
	this.circleOptions = (circleOptions) => {
		if(circleOptions.bindMarker) {
			circleOptions.boundObject = circleOptions.bindMarker._marker;
			circleOptions.bound = true;
		} else if(circleOptions.boundObject) {
			circleOptions.bound = true;
		}
		if(circleOptions.map) circleOptions.map = circleOptions.map._map;
		circleOptions = this.mapUI.translate(circleOptions,[["color","strokeColor"],["opacity","strokeOpacity"],["weight","strokeWeight"]]);
		return circleOptions;
	}

	/* Remove a circle */
	this.circleRemove = (circle) => { circle.remove() };

	/* Center LatLon of a circle */
	this.circleGetLatLon = (circle,obj) => { return this.latLon(circle.getLatLng()) };
	this.circleSetLatLon = (circle,latLon,obj) => { circle.setLatLng(this.latLon(latLon))  }

	/* Radius of a circle */
	this.circleGetRadius = (circle,obj) => { return circle.getRadius(); };
	this.circleSetRadius = (circle,radius,obj) => { circle.setRadius(radius) }

	/* Circle bounds */
	this.circleGetBounds = (circle,obj) => { 
		var b = circle.getBounds(); 
		return {sw: this.latLon(b.sw),ne:this.latLon(b.ne)
		} 
	}

	/* Circle options updater */
	this.circleSetOptions = (circle,circleOptions,obj) => {
		circleOptions = this.circleOptions(circleOptions);
		circle.setOptions(circleOptions);
		if(circleOptions.radius) this.circleSetRadius(circle,circleOptions.radius,obj);
		if(circleOptions.position) this.circleSetLatLon(circle,circleOptions.position,obj);
	}
	/* Get circle property */
	this.circleGetProperty = (circle,property,obj) => {
		if(circle[property]) return circle[property];
		if(circle.options[property]) return circle.options[property];
		return undefined;
	}

	/* Redraw */
	this.circleRedraw = (circle,obj) => { circle.redraw(); }

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
		//let t = new maplibregl.Marker().setLngLat(this.latLon(markerOptions.position)).addTo(markerOptions.map?markerOptions:this.mapUI.map._map);

		let marker = new maplibregl.Marker(markerOptions)
			.setLngLat(this.latLon(markerOptions.position))
			.addTo(markerOptions.map?markerOptions:this.mapUI.map._map);

		marker.bindings = [];

		marker._eventid = "marker_"+this.mapUI.randomKey() //for event handling
		marker.id = markerOptions.id;

		if(markerOptions.title) $(marker._element).prop("title",markerOptions.title);

		if(markerOptions.className) {
			$("#"+marker.id+" img").addClass(markerOptions.className);
		}

		if(markerOptions.animation=="drop") {
			//needed to 'bounce' the marker
			
			var transformMatrix = $("#"+marker.id).css("transform");
			var matrix = transformMatrix.replace(/[^0-9\-.,]/g, '').split(',');
			var x = matrix[12] || matrix[4];//translate x
			var y = matrix[13] || matrix[5];//translate y
			//bounce marker
			$("#"+marker.id).css({"top":-y+"px"});
			$("#"+marker.id).animate({
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
			position: this.latLon(markerOptions.position),
			draggable: markerOptions.draggable==undefined?false:markerOptions.draggable,
			autopan: markerOptions.autopan==undefined?false:markerOptions.autopan,
			title: markerOptions.title==undefined?undefined:markerOptions.title,
			animation: markerOptions.animation==undefined?undefined:markerOptions.animation,
			className: markerOptions.className==undefined?undefined:markerOptions.className,
		}	
		if(markerOptions.shadow) {
			o.shadow = {
				id: markerOptions.shadow.id?markerOptions.shadow.id:o.id+"_shadow",
				className: markerOptions.shadow.className==undefined?undefined:markerOptions.shadow.className,
				position: o.position,
				icon: markerOptions.shadow,
			}
		}
		if(markerOptions.icon && markerOptions.icon.id==undefined) markerOptions.icon.id = o.id;
		//MapboxGL uses a native HTML element as marker icon -- create it if it doesn't exist
		if(markerOptions.icon && $("#"+markerOptions.icon.id).length==0) {
			o.element = this.markerNewIcon(markerOptions.icon);
		}
		if(markerOptions.icon && markerOptions.icon.mousedown) {
			o.mousedown = markerOptions.icon.mousedown;
		}
		return o;
	}

	/* Creates an icon for a marker */
	this.markerNewIcon = (iconOptions) => {
		var img_style = `width: ${iconOptions.iconSize[0]}px;`; 
				img_style+= `height: ${iconOptions.iconSize[1]}px;`;
				img_style+= `margin-top: -${iconOptions.iconAnchor[1]}px;`;
				img_style+= `margin-left: ${iconOptions.iconAnchor[0]}px;`; 
				img_style+= `top: 0px;`;
		var img = `<img src="${iconOptions.iconUrl}" style="${img_style}"/>`;
		var markerIcon = `<div id="${iconOptions.id}" style="width: ${iconOptions.iconSize[0]}px; height:${iconOptions.iconSize[1]}px;">${img}</div>`;
		$('body').append(markerIcon);
		return document.getElementById(iconOptions.id);
	}

	/* Retrieves a link to the icon property of the marker */
	this.markerGetIcon = (marker) => { return $("#"+marker.id+" img")}
	/* Changes the icon base image */
	this.markerSetIcon = (marker,markerIcon) => {
		$(marker.getElement()).html(markerIcon);
	}
	
	/* Gets or sets the hover title of the marker */
	this.markerSetTitle = (marker,title) => {
		$("#"+marker.id).prop("title",title);
	}
	this.markerGetTitle = (marker) => {
		return $("#"+marker.id).prop("title");
	}
	
	/* Popup stuff -- not very fleshed out */
	this.markerOpenPopup = (marker,html,options) => {
			marker._popup = new maplibregl.Popup({
				closeButton: options.closeButton!=undefined?options.closeButton:true,
				closeOnClick: options.closeOnClick!=undefined?options.closeOnClick:false,
				className: options.className!=undefined?options.className:"popup",
			})
			marker._popup.setLngLat(marker.getLngLat())
			if(html!=undefined) marker._popup.setHTML(html);
			marker._popup.addTo(this.mapUI.map._map);
	}

	/* Remove a marker */
	this.markerRemove = (marker) => { marker.remove(); };

	/* latLon of a marker */
	this.markerGetLatLon = (marker) => { return this.latLon(marker.getLngLat()) }
	this.markerSetLatLon = (marker, latLon) => { marker.setLngLat(this.latLon(latLon)) }

	/* Optional functions that are useful for marker UI */

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
		var defaults = {
			stroke: true,
			color: "#000",
			opacity: 1,
			weight: 1,
			fill: true,
			fillColor: "#FFF",
			fillOpacity: 0.5,
			visible: true,
			zindex: 0,
			paneIndex: 390, //LLET only
			pane: "polygonPane" //LLET only
		}
		polygonOptions = {...defaults,...polygonOptions};
		polygonOptions = this.polygonOptions(polygonOptions);
		let poly = mGL.polygon(polygonOptions.coordinates,polygonOptions);
		poly.redraw();
		poly._eventid = "polygon_"+this.mapUI.randomKey() //for event handling
		return poly;
	}

	this.polyline = (polylineOptions) => {
		var defaults = {
			stroke: true,
			color: "#000",
			opacity: 1,
			weight: 1,
			fill: false,
			fillColor: "#FFF",
			fillOpacity: 0.5,
			visible: true,
			zindex: 0,
			paneIndex: 390, //LLET only
			pane: "polygonPane" //LLET only
		}
		polylineOptions = {...defaults,...polylineOptions};

		polylineOptions = this.polygonOptions(polylineOptions);
		let poly = mGL.polyline(polygonOptions.coordinates,polygonOptions);
		poly.redraw();
		poly._eventid = "polygon_"+this.mapUI.randomKey() //for event handling
		return polyline;

	}

	/* Translates settings from Leaflet polygon to whatever else. */
	this.polygonOptions = (polygonOptions) => {
		if(polygonOptions.latLngs) {
			var coords = this.mapUI.latLons(polygonOptions.latLngs);
		}
		if(polygonOptions.latLons) {
			var coords = this.mapUI.latLons(polygonOptions.latLons);
		}
		if(coords) {
			polygonOptions.coordinates = [this.reverse([...coords])];
		}
		if(polygonOptions.map) polygonOptions.map = polygonOptions.map._map;
		polygonOptions = this.mapUI.translate(polygonOptions,[["color","strokeColor"],["opacity","strokeOpacity"],["weight","strokeWeight"]]);
		return polygonOptions;
	}

	/* Flips coordinate arrays from lat,lon to lon,lat */
	this.reverse = (arr) => {
		//console.log("==>",arr);
		for(var i in arr) {
			if(Array.isArray(arr[i])) {
				arr[i] = this.reverse(arr[i]);
			} else {
				if(typeof arr[i]=="object") {
					if(arr[i].lat!=undefined && arr[i].lon!=undefined) {
						arr[i] = [arr[i].lon,arr[i].lat];
					} else if(arr[i].lat!=undefined && arr[i].lng!=undefined) {
						arr[i] = [arr[i].lng,arr[i].lat];
					}
				}
			}
		}
		return arr;
	}

	/* Remove a polygon */
	this.polygonRemove = (polygon) => { polygon.remove(); };

	/* latLon of polygon centroid */
	this.polygonGetCenter = (polygon) => { return this.latLon(polygon.getCenter()) }
	
	/* Get latLons of polygon positions */
	/* On of the few places we need to reverse the results */
	this.polygonGetLatLons = (polygon,obj) => {
		return this.mapUI.latLons(polygon.coordinates[0],(pos)=>{ return [pos[1],pos[0]] });
	}

	/* Replaces all positions of polygon with new ones. */
	this.polygonSetLatLons = (polygon,latLons,obj) => {
		var coords = this.mapUI.latLons(latLons);
		if(coords) {
			polygon.coordinates = [this.reverse([...coords])];
		}
		polygon.redraw();
	}

	/* Get polygon property */
	this.polygonGetProperty = (polygon,property,obj) => {
		if(polygon[property]) return polygon[property];
		if(polygon.options[property]) return polygon.options[property];
		return undefined;
	}

	/* Redraw */
	this.polygonRedraw = (polygon,obj) => { polygon.redraw(); }

	/* Add a single latLon to polygon */
	this.polygonAddLatLon = (polygon, latLon, obj) => { latLon = this.latLon(latLon); polygon.addLngLat([latLon.lon,latLon.lat]);}
	
	/* Returns true if the polygon has no points */
	this.polygonIsEmpty = (polygon, obj) => { return polygon.isEmpty() }

	/* Returns polygon bounds */
	this.polygonGetBounds = (polygon, obj) => {
		var b = polygon.getBounds(); 
		return {sw: this.latLon(b.sw),ne:this.latLon(b.ne)} 
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
		if(subject.obj != undefined) {
			if(subject.obj._marker != undefined) {
				switch(event) {
					case "mouseup": case "mousedown": //will end up routing these to jquery because maplibregl does not support them for marker object
						return {subject:$("#"+subject.obj._marker.id),event_name:event,subject_eventid:subject._eventid}; 
					break;
					default: return event; break;
				}
			} else {
				return event;
			}
		} else {
			return event;
		}
	}

	/* CONTROLS */

	this.addLayerControl = (options,obj) => {
		options.beforebaselayerchange = () => {
			if(DEBUG) console.log("beforebaselayerchange",this.mapUI.map._map);
		}
		options.onbaselayerchange = (newbaselayer,lc,oldbaselayer)=>{
			if(DEBUG) console.log("onbaselayerchange",newbaselayer,lc,oldbaselayer);

			if(typeof this.mapUI.options.onlayerchangestart=="function") {
				this.mapUI.options.onlayerchangestart.call(this,newbaselayer,lc,oldbaselayer);
			}
			//This will wait until the map hits an idle state before updating. Seems to be 
			//the best way to do this without a timeout, even though it involves a bit of a delay since the entire map will need
			//to render before restores.
			//Trying once.render -- will load as soon as first tile renders, which should be OK.
			this.mapUI.map._map.once("render",()=> {
				mGL.util.restoreFromCache();	//restores any layers 	
				if(typeof this.mapUI.options.onlayerchangedone=="function") {
					this.mapUI.options.onlayerchangedone.call(this,newbaselayer,lc,oldbaselayer);
				}
			})
		}
		this.layerControl = mGL.layerControl(this.baseLayers,{},options.mapChecks,options).addTo(this.mapUI.map._map);
	}
	this.addZoomControl = (options, obj) => {		
		this.zoomControl = new maplibregl.NavigationControl(options);
		this.mapUI.map._map.addControl(this.zoomControl, this.controlPosition(options.position));
	}

	this.addScaleControl = (options, obj) => {
		if(options.units==1) {
			options.unit = "imperial";
		} else {
			options.unit = "metric";
		}
		this.scaleControl = new maplibregl.ScaleControl(options);
		switch(options.position) {
			case "topright": options.position = "top-right"; break;
			case "topleft": options.position = "top-left"; break;
			case "bottomright": options.position = "bottom-right"; break;
			case "bottomleft": options.position = "bottom-left"; break;
			default: options.position = options.position?options.position:"top-right"; break;
		}
		this.mapUI.map._map.addControl(this.scaleControl,options.position);
		return this.scaleControl;
	}
	this.removeScaleControl = (obj) => {
		if(DEBUG) console.log("removeScaleControl",this.scaleControl);
		if(this.scaleControl) {
			$(this.scaleControl._container).remove();
			delete this.scaleControl;
		}
	}
	this.updateScaleControl = (units,obj) => {
		if(units==1) {
			this.scaleControl.setUnit("imperial");
		} else {
			this.scaleControl.setUnit("metric");
		}
	}

	/* Translates control position names */ 
	this.controlPosition = (position) => {
		return position.replace("top","top-").replace("bottom","bottom-").replace("--","-");
	}


	/* MISC */

	/* Convert a pixel location on the map DIV (px,py) to lat/lon */
	this.pixelToLatLon = (px,py) => {
		return this.mapUI.map.containerPointToLatLng([px,py]);
	};
	this.mouseEventLatLon = (e) => {
		return {lat:e.lngLat.lat, lon: e.lngLat.lng}
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
