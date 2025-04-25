/* Library to emulate (missing) Leaflet-like UI elements in MapboxGL/MapLibreGL. 
 * by Alex Wellerstein, 2023.
 * 
 * Elements supported:
 *  - LayerControl
 *  - Polygon
 *  - Circle (great circles)
 * 
 * Also useful utility functions that will cause these elements to be redrawn
 * if the underlying basemap gets changed (as happens if you use the LayerControl).
*/

class mGL_ui {
	constructor(map,options) {
		if(typeof map=="undefined") {
			console.log("mGL: No map specified!");
			return false;
		}
		var defaults = {
			fillUnderLabels: false, //whether fills are rendered on top of, or under, label layers
			eventWait: 50 //length of time to wait (in ms) before processing event queue. on my machine setting this to 0 still works, but feels safe to make it nonzero.
		}
		this.options = {...defaults,...options};
		this.map = map;
	}
	objectCount = 0;

	//holds clicked objects, because for stacked objects, they add in the opposite order.
	lastEventObject = {
		click: undefined,
		click_z: undefined,
		mouseenter: undefined,
		mouseenter_z: undefined,
		mousemove: undefined,
		mousemove_z: undefined,
		mouseleave: undefined,
		mouseleave_z: undefined
	}
	eventChecker = {
		click: undefined,
		mouseenter: undefined,
		mousemove: undefined,
		mouseleave: undefined
	}
	eventListeners = []

	// Caches are used to keep track of layers and sources after map style changes.
	caches = {
		sources: [],
		layers: [],
		ADDED: true,
		UPDATED: -1,
		DELETED: true,
		NOT_FOUND: false,
		updateLayer: function(layer) {
			for(var i in this.layers) {
				if(this.layers[i].id == layer.id) {
					this.layers[i] = layer;
					return this.UPDATED;
				}
			}
			this.layers.push(layer);
			return this.ADDED;		
		},
		updateSource: function(source) {
			for(var i in this.sources) {
				if(this.sources[i].id == source.id) {
					this.sources[i].data = source.data;					
					return this.UPDATED;
				}
			}
			this.sources.push(source);
			return this.ADDED;	
		},
		removeLayer: function(id) {
			for(var i in this.layers) {
				if(this.layers[i].id == id) {
					this.layers.splice(i,1);
					return this.DELETED;
				}
			}
			return this.NOT_FOUND;
		},
		removeSource: function(id) {
			for(var i in this.sources) {
				if(this.sources[i].id == id) {
					this.sources.splice(i,1);
					return this.DELETED;
				}
			}
			return this.NOT_FOUND;
		}
	}
	util = {
		mGL_ui: this,
		findId: function(arr,id) {
			for(var i in arr) {
				if(arr[i].id==id) return i;
			}
			return false;
		},
		//redraws all layers from cache.
		redrawLayers: function() {
			var map = this.mGL_ui.map;
			/*if(!this.options.beforeId) {
				if(this.mGL_ui.options.fillUnderLabels) {
					var beforeId = this.mGL_ui.util.lastTextLayer();
				}
			} else {
				var beforeId = this.options.beforeId;
			}*/
			for(var i in this.mGL_ui.caches.layers) {
				if(typeof this.mGL_ui.caches.layers[i].beforeId!="undefined") {
					var beforeId = this.mGL_ui.caches.layers[i].beforeId;
				} else {
					var beforeId = "";
				}
				if(map.getLayer(this.mGL_ui.caches.layers[i].id)) {
					map.removeLayer(this.mGL_ui.caches.layers[i].id);
				}
				map.addLayer(this.mGL_ui.caches.layers[i],beforeId);
			}			
		},
		//restores all layers after a style change
		restoreFromCache: function () {
			var map = this.mGL_ui.map;
			//remove all layers
			if(this.mGL_ui.caches.layers.length==0) return false;
			for(var i in this.mGL_ui.caches.layers) {
				if(map.getLayer(this.mGL_ui.caches.layers[i].id)) {
					map.removeLayer(this.mGL_ui.caches.layers[i].id);
				}
			}
			//remove all sources
			if(this.mGL_ui.caches.sources.length==0) return false;
			for(var i in this.mGL_ui.caches.sources) {
				var dataSource = this.mGL_ui.caches.sources[i];
				if(map.getSource(dataSource.id)) {
					map.removeSource(dataSource.id);
				}
				//re-add source
				delete dataSource.data.collectResourceTiming; //I don't know why this is necessary, but it totally fails if we don't delete this
				map.addSource(dataSource.id,dataSource.data);		
			}
			//re-add layers
			this.redrawLayers();
		},
		getFeatureByLayerId: function(id) {
			var map = this.mGL_ui.map;
			var f = map.queryRenderedFeatures();
			for(var i in f) {
				if(f[i].layer.id==id) {
					return {feature:f[i],index:i};
				}
			}
			return false;
		},
		lastTextLayer: function() {
			var map = this.mGL_ui.map;
			const layers = map.getStyle().layers;
			const labelLayerId = layers.find(
				(layer) => layer.type === 'symbol' && layer.layout['text-field']
			).id;
			return labelLayerId;	
		},
		//a rounding function with decimal precision, which is necessary for the next function.
		round: function(number, decimals = 0) {
			if(decimals==0) return Math.round(number);
			var multiplier = Math.pow(10, decimals);
			return Math.round(number * multiplier) / multiplier;
		},
		// generates a random alphanumeric string
		randomKey: function() {
			return Math.round((Math.random() * 1e18)).toString(36).substr(0,10);
		},
		//returns destination lat/lon from a start point lat/lon of a giving bearing (degrees) and distance (km).
		//round_off will round to a given precision. 
		//based on the haversine formula implementation at: https://www.movable-type.co.uk/scripts/latlong.html
		destination_from_bearing: function(lat,lng,bearing,distance, round_off = undefined) {
			var R = 6371; // mean radius of the Earth, in km
			var d = distance;
			const deg2rad =  Math.PI / 180; const rad2deg = 180 / Math.PI;
			var lat1 = deg2rad*lat;
			var lng1 = deg2rad*lng;
			var brng = deg2rad*bearing;
			//kind of a sad attempt at optimization of these costly trig functions
			var sinLat1 = Math.sin(lat1); var cosLat1 = Math.cos(lat1);
			var cosdR = Math.cos(d/R); var sindR = Math.sin(d/R);
			var lat2 = Math.asin(sinLat1*cosdR+cosLat1*sindR*Math.cos(brng));
			var lng2 = lng1+Math.atan2(Math.sin(brng)*sindR*cosLat1,cosdR-sinLat1*Math.sin(lat2));
			if(typeof round_off != "undefined") {
				return [this.round(rad2deg*lat2,round_off),this.round(rad2deg*lng2,round_off)];
			} else {
				return [(rad2deg*lat2),(rad2deg*lng2)];
			}
		},
		//function that returns the points necessary to draw a great circle on a web-Mercator map
		//arguments that need to be passed are position (in the form of [lat,lon]) and radius (in meters), plus possible options.
		greatCirclePoints: function(position, radius, options = {}) {
			var defaults = {
				clipLat: 80, //lat (+/-) used to determine when regular circles might be used. set to false to force render of circle as polygon (no matter what), or true to render it as a normal circle (no matter what)
				clipRad: 2000000, //radius (m) at which it will always render a polygon, unless clipLat == true. 
				degStep: 0.5, //degrees by which the circle drawing function will step for each polygon -- smaller is more refined. 
				maxCopies: -1, //set a maximum number of copies if elements are wrapped -- -1 is no max. 
				wrapElements: false, //whether to wrap the elements as multiple copies. -- NOT NEEDED IN MAPBOXGL, it wraps automatically
				maxRadius: 20015086.5, //cap on radius
				closeLine: true, //whether the line needs to have its first position repliated at the end to close it
				lngLat: true, //if true, will return coordinates at lng-lat rather than lat-lng
				mapZoom: 12, //how zoomed in the map is -- required for copies. if -1, will not make copies.
			}

			if(typeof position == "undefined") { console.log("mGL: circle: no position specified"); return false; }
			if(typeof radius == "undefined") { console.log("mGL: circle: no radius specified"); return false; }

			options = {...defaults,...options}; //combine with defaults

			//math constants
			const m2km = 1/1000; //obvious but improves code legibility

			if(Array.isArray(position)) {
				var lat = position[0]; 
				var lng = position[1]; 
			} else {
				var lat = position.lat;
				var lng = position.lng;
			}

			if(options.maxRadius != -1) {
				if(radius > options.maxRadius) radius = options.maxRadius;
			}

			//These are control points that we can evaluate to see if it is clipping against the poles.
			//l1 and l2 are the top of the circle, l3 and l4 are the bottom.
			//In a closed circle, l1==l2 and l3==l4. In a clipped circle, one or both of these
			//conditions will not be true. Rounding used to deal with precision errors.
			var l1 = this.destination_from_bearing(lat,lng,0,radius*m2km, 3);
			var l2 = this.destination_from_bearing(lat,lng,360,radius*m2km, 3);			
			var l3 = this.destination_from_bearing(lat,lng,180,radius*m2km, 3);
			var l4 = this.destination_from_bearing(lat,lng,-180,radius*m2km, 3);
			
			var clipStatus;
			//now check for the 4 possible clipping conditions
			if( (l1[0]!=l2[0]||l1[1]!=l2[1]) && (l3[0]!=l4[0]||l3[1]!=l4[1]) ) {
				clipStatus = 4; //both the top AND bottom of the circle is clipped (which means that there will be "holes" in the polygon) -- most complex case
			} else if( l1[0]!=l2[0]||l1[1]!=l2[1]) {
				clipStatus = 2; //top of the circle is clipped (moderately complex polygon)
			} else if( l3[0]!=l4[0]||l3[1]!=l4[1]) {
				clipStatus = 3; //bottom of the circle is clipped (moderately complex polygon)
			} else {
				clipStatus = 1; //no clipping at all (the circle is closed)
			}

			//figure out how many copies to render.
			//copies are copies to the left AND right of the main instance.
			//so 1 copy is 3 instances. 2 copies is 5. 0 copies is just the main instance.
			//for zooms 0-2, it tries to guess based on the pixels (which depends on browser zoom). for >2, just assumes 1 is OK. 
			var copies;
			switch(options.mapZoom) {
				case 0: 
					copies = Math.ceil((window.innerWidth / 256) /4)+2; 
					break;
				case 1:
					copies = Math.ceil((window.innerWidth / 512) /4)+2; 
					break;
				case 2:
					copies = Math.ceil((window.innerWidth / 768) /4)+1; 
				break;
				default: copies = 1; break;
			}
			//see if options override the above
			if(options.maxCopies > -1) copies = copies>options.maxCopies?options.maxCopies:copies;
			if(options.wrapElements === false) copies = 0;

			//start to create the circle polygon

			//initialize arrays of points
			var latLngs = []; //array of lat/lngs for polygon
			var latLngsM = []; //array for multipolygons
						
			//for each of the possible clipping scenarios, we draw the circles differently. this aids in assembling the polygons into coherent shapes that can be 
			//seamlessly joined together.
			//the basic algorithm draws the circles in two halves (the reason for this is because of complex clipStatus = 4, which requires putting the halves into different polygons).
			//the numbers below give two pieces of information for each half: what angle (degree) to start at, what angle to draw until. direction of movement through the start/stop is then inferred.
			//in the clipping cases, it also adds an additional point at the beginning of the polygon (the "lower" or "upper" edge).
			switch(clipStatus) {
				case 1: //perfect circle -- easy
					var t_start1 = 0; var t_stop1 = 180;  
					var t_start2 = 180; var t_stop2 = 360;  
				break;
				case 2: //top clipping -- work backwards
					var t_start1 = 360; var t_stop1 = 180; 
					var t_start2 = 180; var t_stop2 = 0;
					latLngs.push([90,l2[1]+(360*(-1*copies))]);
				break;
				case 3: //bottom clipping -- works best as -180 to 180
					var t_start1 = -180; var t_stop1 = 0; 
					var t_start2 = 0; var t_stop2 = 180;
					latLngs.push([-90,l4[1]+(360*(-1*copies))]);						
				break;
				case 4: //weird case 4 -- also works bet as -180 to 180
					var t_start1 = -180; var t_stop1 = 0; 
					var t_start2 = 0; var t_stop2 = 180; 
					latLngs.push([-90,l4[1]+(360*(-1*copies))]);						
				break;
			}
			//infer direction
			if(t_start1<t_stop1) { var t_dir1 = 1; } else { var t_dir1 = -1; }
			if(t_start2<t_stop2) { var t_dir2 = 1; } else { var t_dir2 = -1; }

			//now we render the circles. we do this for each of the copies.
			for(var copy=copies*-1;copy<=copies;copy++) {

				//iterate over polygon, using geo function to get lat/lng points, for the first half of the circle
				for(var theta=t_start1;  t_dir1>0?(theta < t_stop1):(theta > t_stop1);  theta+=(options.degStep*t_dir1)) {
					var ll = this.destination_from_bearing(lat,lng,theta,radius*m2km);
					ll[1] = ll[1]+(360*copy);
					latLngs.push(ll);
				}

				//special actions for weird clipStatus = 4 -- this pushes the points around so they form better polygons (a big polygon in the 0 array, and the rest are "holes")
				//the logic of this is basically: for the very far left copy (copy = -copies), it adds a bottom "edge" and then kicks it to the 0 position of _latLngsM.
				//for the middle copies, it puts the "left" half of the circle into the _latLngM array created by the previous copy, where it becomes the "right" side of a hole.
				//for the last, far-right copy (copy = copies), it preps the last part of the circle by adding a control point.
				if(clipStatus==4) {
					var ll = this.destination_from_bearing(lat,lng,360,radius*m2km);
					latLngs.push([ll[0],ll[1]+(360*copy)]);
					if(copy==copies*-1) {
						var ll = this.destination_from_bearing(lat,lng,-180,radius*m2km);
						latLngs.push([90,ll[1]+(360*(-1*copies))]);
						var ll = this.destination_from_bearing(lat,lng,180,radius*m2km);
						latLngs.push([90,ll[1]+(360*(-1*copies))]);
						latLngsM.push(latLngs);
					} else {
						latLngsM[latLngsM.length-1] = latLngsM[latLngsM.length-1].concat(latLngs);
					}
					latLngs = [];
					if(copy==copies) {
						var ll = this.destination_from_bearing(lat,lng,0,radius*m2km);
						latLngs.push([90,ll[1]+(360*(1*copies))]);
					}
				}
				
				//draw second half of the circle
				for(var theta=t_start2;  t_dir2>0?(theta < t_stop2):(theta > t_stop2);  theta+=(options.degStep*t_dir2)) {
					var ll = this.destination_from_bearing(lat,lng,theta,radius*m2km);
					ll[1] = ll[1]+(360*copy);
					latLngs.push(ll);
				}

				//again process for the clipstatus = 4 situation. in this case, if it is the last copy (copy = copies), we add a final control point and then push it into _latLngsM[0], where it is now
				//part of a giant polygon with the far left control point. For any other case, we create a new _latLngsM array of points, where this "right" side of a circle will be coupled with the "left" of the next copy.
				//again, the logic of this is confusing, but it makes sense if you graph it out: we have made a giant polygon, and used the other points to define coherent "holes" in the polygon.
				//the array pushing and concatenation is a way to juggle all this. 
				if(clipStatus==4) {
					var ll = this.destination_from_bearing(lat,lng,180,radius*m2km);
					latLngs.push([ll[0],ll[1]+(360*copy)]);
					if(copy==copies) {
						var ll = this.destination_from_bearing(lat,lng,180,radius*m2km);
						latLngs.push([-90,ll[1]+(360*(1*copies))]);						
						latLngsM[0] = latLngsM[0].concat(latLngs);
					} else {
						latLngsM.push(latLngs);
					}
					latLngs = [];
				}
				
				//for the non-clipping case, we push each coherent circle to a multipolygon so lines don't connect the disconnected bits
				if(clipStatus==1) { 
					if(typeof latLngsM == "undefined") latLngsM = [];
					latLngsM.push(latLngs);
					latLngs = [];
				}
			}

			//now that we're done, there are still a few final control points that need to be added in two of the cases (top and bottom)
			switch(clipStatus) {
				case 2: 
					var ll = this.destination_from_bearing(lat,lng,0,radius*m2km);
					latLngs.push([ll[0],ll[1]+(360*(copies))]);
					latLngs.push([90,ll[1]+(360*(copies))]);
				break;
				case 3:
					var ll = this.destination_from_bearing(lat,lng,180,radius*m2km);
					latLngs.push([ll[0],ll[1]+(360*(copies))]);
					latLngs.push([-90,ll[1]+(360*(copies))]);
				break;				
			}

			function reversePairs(arr) {		
				var arr2 = [];
				arr.forEach(function(p,i) { arr2[i] = [p[1],p[0]]; });
				return arr2;
			}

			if(clipStatus == 1 || clipStatus == 4) { //multipolygon
				if(options.lngLat) {
					var _latLngsM = [];
					for(var i in latLngsM) {
						_latLngsM.push(reversePairs(latLngsM[i]));
						if(options.closeLine) _latLngsM[i].push([_latLngsM[i][0][0],_latLngsM[i][0][1]]);
					}
					return _latLngsM;
				} else {
					if(options.closeLine) {
						for(var i in latLngsM) {
							latLngsM[i].push([latLngsM[i][0][0],latLngsM[i][0][1]]);
						}
					}

					return latLngsM;
				}
			} else { //render single polygon
				if(options.closeLine) {
					latLngs.push([latLngs[0][0],latLngs[0][1]])
				}
				if(options.lngLat) {
					return [reversePairs(latLngs)];
				} else {
					return [latLngs];
				}
			}
		}
	}

	/* 
	* A MapboxGL emulation of Leaflet's layer control, with some additional
	* capabilities and options that the original doesn't have.
	*/
	layerControl(baseLayers = [],overlayLayers = [],checkOptions = [], options = {}) {
		var lc = {};
		var defaults = {
			collapsed: true,
			position: "topright",
			id_no: this.util.randomKey(),
			onbaselayerchange: undefined,
			beforebaselayerchange: undefined,
			overrideDefaultEvents: false, //will not do the normal style changes, requires onchange events to do anything
		}
		lc.options = {...defaults,...options}
		lc.baseLayers = baseLayers;
		lc.overlayLayers = overlayLayers;
		lc.checkOptions = checkOptions;

		//Right now not worrying about doing this kind of thing on the fly.
		//I guess it could be set up so that add_to uses the below functions.
		//Right now it does not.
		lc.addBaseLayer = function (layer) {

		}
		lc.addOverlay = function(layer) {

		}
		lc.removeLayer = function(layer) {

		}
		lc.expand = function() {

		}
		lc.collapse = function() {
			
		}
		lc.getPosition = function() {
			return lc.position;
		}
		lc.setPosition = function() {
			//needs to move the control to another DIV I guess
		}
		lc.getContainer = function () {
			return $(".mbui-control-layers");
		}
		lc.addTo = function(map) {
			lc.map = map;
			var map_container = lc.map._container;
			//want to make it so that if the layer length is just 1, and there are
			//no mapchecks, it doesn't render the control. but not a high priority.

			if(!$(".mbui-control-container").length) {
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
			if(lc.baseLayers.length>0) {
				var base_div = document.createElement("div");
				$(base_div).addClass("leaflet-control-layers-base");
				for(var i in lc.baseLayers) {
					var layer = lc.baseLayers[i];
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
						var sel = $(this).prop("i");
						if(lc.baseLayer != sel) {
							var oldBaseLayer = lc.baseLayer;
							if(typeof lc.options.beforebaselayerchange == "function") {
								lc.options.beforebaselayerchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer)
							}
							lc.baseLayer = sel;
							if(lc.baseLayers[sel].key) {
								maplibregl.accessToken = lc.baseLayers[sel].key;
							} else {
								maplibregl.accessToken = "";
							}
							if(!lc.options.overrideDefaultEvents) {
								map.setStyle(lc.baseLayers[sel].style);
							}
							if(typeof lc.baseLayers[sel].onchange == "function") {
								lc.baseLayers[sel].onchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer)
							}
							if(typeof lc.options.onbaselayerchange == "function") {
								lc.options.onbaselayerchange.call(this,lc.baseLayers[sel],lc,lc.baseLayers[oldBaseLayer],sel,oldBaseLayer);
							}
						}
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
			if(lc.baseLayers.length>0 && lc.overlayLayers.length>0) {
				var sep_div = document.createElement("div");
				$(sep_div).addClass("leaflet-control-layers-separator");
				$(sep_div).appendTo($(section));
			}
			if(lc.overlayLayers.length>0) {
				//I don't really use overlays
				//I don't think they really exist in mapbox gl? This would just
				//mean adding layers. Could add this capability for the future
				//but it has no impact on NUKEMAP so I'm ignoring this for now.
			}
			if(lc.overlayLayers.length>0 && lc.checkOptions.length>0 || 
				lc.baseLayers.length>0 && lc.checkOptions.length>0) {
					var sep_div = document.createElement("div");
					$(sep_div).addClass("leaflet-control-layers-separator");
					$(sep_div).appendTo($(section));
			}
			//These are my own creation -- just arbitrary checkboxes that
			//run code when selected. Could use these like overlays if you wanted.
			if(lc.checkOptions.length>0) {
				var optionDiv = document.createElement("div");
				$(base_div).addClass("leaflet-control-layers-options");
				for(var i in lc.checkOptions) {
					var option = lc.checkOptions[i];
					var optionLabel = document.createElement("label");
					var optionSpan = document.createElement("span");
					var optionCheck = document.createElement("input");
					$(optionCheck).prop("type","checkbox");
					$(optionCheck).prop("i",i);
					$(optionCheck).addClass("leaflet-control-layers-selector");
					if(option.selected) {
						$(optionCheck).prop("checked",option.selected);
					}
					$(optionCheck).prop("name","leaflet-option-layers_"+lc.options.id_no+"_"+i);
					$(optionCheck).appendTo(optionSpan);
					$(optionCheck).on("click",function() {
						//console.log("lc option click");
						var sel = $(this).prop("i");
						var selected = $(this).prop("checked");
						lc.checkOptions[sel].selected = selected;
						if(typeof lc.checkOptions[sel].onchange == "function") {
							lc.checkOptions[sel].onchange.call(this,selected,lc)
						}
					})
					var optionNameSpan = document.createElement("span");
					$(optionNameSpan).text(option.name);
					$(optionNameSpan).appendTo(optionSpan);
					$(optionSpan).appendTo(optionLabel);
					$(optionLabel).appendTo(optionDiv);
					if(option.hover) $(optionLabel).prop("title",option.hover);
				}
				$(optionDiv).appendTo($(section));
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
		}
		lc.remove = function() {

		}
		return lc;		
	}

	/* 
	* A wrapper for drawing arbitrary polygons in MapboxGL. Renders them as 
	* a GeoJSON data object which has two layers (a fill and a stroke) bound
	* to it. 
	*/
	polygon = (coordinates, options = {}) => {
		var map = this.map;
		var gp = {};
		gp.map = this.map;
		gp.mGL_ui = this;
		var defaults = {
			id: "polygon_"+this.util.randomKey(), //internal id -- will be random if not set
			relativeCoordinates: false, 
			relativePosition: undefined, //if using relative coordinates, then will be relative to this position
			fillColor:  "#0080ff",
			fillOpacity: 0.5,
			strokeColor: "#000000",
			strokeWeight: 3,
			strokeOpacity: 1.0,
			visible: true,
			fill: true,
			stroke: true,
			bound: options.bound?options.bound:(options.boundObject?true:false),
			boundObject: undefined,
			onclick: false,
			clickLayer: "fill",
			beforeId: undefined,
			zindex: this.objectCount
		}
		gp.coordinates = coordinates;
		gp.options = {...defaults,...options}
		gp.id = gp.options.id;
		if(typeof gp.coordinates == "undefined") { console.log("mGl.polygon: No coordinates specified!"); return false; }
		if(gp.options.relativeCoordinates) {
			gp.coordinatesRelative = coordinates;
		}
		this.objectCount++;
		/* Create data source and layers */
		gp.draw = function() {
			var map = this.map;
			if(!this.options.relativeCoordinates) {
				var coords = gp.coordinates;
			} else {
				var coords = [];
				if(Array.isArray(gp.options.relativePosition)) {
					var lat = +gp.options.relativePosition[1];
					var lng = +gp.options.relativePosition[0];
				} else {
					var lat = +gp.options.relativePosition.lat;
					if(typeof gp.options.relativePosition.lng) {
						var lng = +gp.options.relativePosition.lng;
					} else {
						var lng = +gp.options.relativePosition.lon;
					}
				}
				for(var i in gp.coordinatesRelative[0]) {					
					coords.push([+gp.coordinatesRelative[0][i][1]+lng,+gp.coordinatesRelative[0][i][0]+lat]);
				}
				coords = [coords];
			}
			var dataSource = {
				id: gp.id,
				data: {
					'type': 'geojson',
					'data': {
						'type': 'Feature',
						'geometry': {
							'type': 'Polygon',
							'coordinates': coords
						}
					}
				}
			}

			map.addSource(dataSource.id,dataSource.data);
			gp.mGL_ui.caches.updateSource(dataSource);

			var fill_visible = true;
			if(!gp.options.fill) fill_visible = false;
			if(!gp.options.visible) fill_visible = false;

			gp.fillLayer = gp.id+"_fill";
			var fillLayer = {
				'id': gp.fillLayer,
				'type': 'fill',
				'source': gp.id, 
				'layout': {
					'visibility': fill_visible?"visible":"none"
				},
				'paint': {
					'fill-color': gp.options.fillColor, 
					'fill-opacity': gp.options.fillOpacity
				}
			};

			if(!gp.options.beforeId) {
				if(gp.mGL_ui.options.fillUnderLabels) {
					var beforeId = gp.mGL_ui.util.lastTextLayer();
				}
			} else {
				var beforeId = gp.options.beforeId;
			}
			map.addLayer(fillLayer,beforeId);
			fillLayer.beforeId = beforeId;
			gp.mGL_ui.caches.updateLayer(fillLayer);

			var stroke_visible = true;
			if(!gp.options.stroke) stroke_visible = false;
			if(!gp.options.visible) stroke_visible = false; 

			gp.strokeLayer = gp.id+"_stroke";
			var strokeLayer = {
				'id': gp.id+"_stroke",
				'type': 'line',
				'source': gp.id,
				'layout': {
					'visibility': stroke_visible?"visible":"none"
				},
				'paint': {
					'line-color': gp.options.strokeColor,
					'line-width': gp.options.strokeWeight,
					'line-opacity': gp.options.strokeOpacity,
				}
			};
			map.addLayer(strokeLayer,beforeId);
			strokeLayer.beforeId = beforeId;
			gp.mGL_ui.caches.updateLayer(strokeLayer);
		}

		/* Event handlers. Note that it wraps the actual function and
		 * keeps track of the original function and the wrapped function
		 * in the eventListeners array. 
		 * 
		 * The map itself will trigger the events on every item under the mouse
		 * on the clickLayer. In order to get the "top" item, we don't process
		 * the click immediately, and instead wait a small amount of time (eventWait,
		 * e.g. 50ms) and see how many events come in. The zindex property, which only
		 * governs event priority, is used to sort out multiple events. If not set
		 * explicitly it will correspond with when the object is added to the map.
		 * 
		 * One tricky thing is that there are situations where clicking on a marker will
		 * for some reason register as a map click even though the marker should have
		 * captured the event. Could try to detect for this. But not high priority.
		 */
		gp.on = function(eventname,func) {
			if(gp.options.clickLayer=="fill") {
				var clickLayer = gp.fillLayer;
			} else if(gp.options.clickLayer == "stroke") {
				var clickLayer = gp.strokeLayer;
			}
			var wrapper = (e) => {
				eventname = e.type;
				var addevent = false;
				if(gp.mGL_ui.lastEventObject[eventname+"_z"]!=undefined) {
					if(gp.options.zindex==undefined) gp.options.zindex = 0;
					if(gp.options.zindex>=gp.mGL_ui.lastEventObject[eventname+"_z"]) {
						addevent = true;
					}
				} else {
					addevent = true;
				}
				if(addevent) {
					gp.mGL_ui.lastEventObject[eventname+"_z"] = gp.options.zindex;
					gp.mGL_ui.lastEventObject[eventname] = () => {		
						func.call(gp,e)
					}
					if(typeof gp.mGL_ui.eventChecker[eventname]=="undefined") {
						gp.mGL_ui.eventChecker[eventname] = setTimeout(function() {
							if(typeof gp.mGL_ui.lastEventObject[eventname]  == "function") {
								gp.mGL_ui.lastEventObject[eventname].call(gp);
							}								
							gp.mGL_ui.lastEventObject[eventname] = undefined;
							gp.mGL_ui.lastEventObject[eventname+"_z"] = undefined;
							gp.mGL_ui.eventChecker[eventname] = undefined;
						},gp.mGL_ui.options.eventWait);
					}
				}
			}
			gp.mGL_ui.eventListeners.push({
				"eventname":eventname,
				"clickLayer":clickLayer,
				"func": func,
				"wrapper": wrapper
			})
			map.on(eventname,clickLayer,wrapper)
		}

		gp.off = function(eventname,func) {
			if(gp.options.clickLayer=="fill") {
				var clickLayer = gp.fillLayer;
			} else if(gp.options.clickLayer == "stroke") {
				var clickLayer = gp.strokeLayer;
			}
			for(var i in gp.mGL_ui.eventListeners) {
				var ev = gp.mGL_ui.eventListeners[i];
				if(ev.eventname==eventname && ev.clickLayer==clickLayer && ev.func.toString() == func.toString()) {
					map.off(eventname,clickLayer,ev.wrapper);
					delete gp.mGL_ui.eventListeners[i];
					return true;
				}
			}
			return false;
		}

		/* Calculates the centroid using a very, very simple (and probably inaccurate for
		 * complex polygons) method, returns at LatLng. */
		gp.getCenter = function () {
			var b = gp.getBounds();
			return {lng: b.ne.lat + ((b.sw.lat - b.ne.lat) / 2), lat: b.sw.lng + ((b.ne.lng - b.sw.lng) / 2)}
		}

		/* Adds a coordinate to the polygon that already exists. Expects input to be [lng,lat] */
		gp.addLngLat = function(lngLat) {
			var coords = gp.coordinates[0];
			coords.push(lngLat);
			gp.coordinates = [coords];
			gp.redraw();
		}

		/* Should return true if polygon has coordinates, false if not */
		gp.isEmpty = function() {
			return gp.coordinates==undefined||gp.coordinates.length==0||gp.coordinates[0].length==0;
		}

		/* Will return an object with the lat/lng coordinates of the 
		 * southwestern and northeastern extent of the polygon coordinates. */
		gp.getBounds = function() {
			var coords = gp.coordinates[0];
			var minx = 1000, miny = 1000;
			var maxx = -1000, maxy = -1000;
			for (var i = 0; i < coords.length; i++) {
				var point = coords[i];
				var x = point[0];
				var y = point[1];
				if (x < minx) minx = x
				else if (x > maxx) maxx = x
				if (y < miny) miny = y
				else if (y > maxy) maxy = y
			}			
			return { sw: {lng:minx,lat:miny}, ne: {lng:maxx,lat:maxy}};			
		}

		/* Recalculates the data */
		gp.redraw = function() {
			var map = this.map;
			var data = {
				'type': 'Feature',
				'geometry': {
					'type': 'Polygon',
					'coordinates': gp.coordinates
				}
			}
			map.getSource(gp.id).setData(data);
			this.mGL_ui.caches.updateSource({id: gp.id, data: {'type':'geojson','data':data}})
		}

		/* Removes all entities */
		gp.remove = function() {
			var map = this.map;
			map.removeLayer(gp.fillLayer);
			this.mGL_ui.caches.removeLayer(gp.fillLayer);
			map.removeLayer(gp.strokeLayer);
			this.mGL_ui.caches.removeLayer(gp.strokeLayer);
			map.removeSource(gp.id);
			this.mGL_ui.caches.removeSource(gp.id);
		}

		/* Allows changing of options for layers */
		gp.setOptions = function(options) {
			//special thing for event handlers (need to preserve original handlers to remove them)
			if(typeof options.onclick != "undefined") {
				var _onclick = options.onclick;
				var _clickLayer = gp.options.clickLayer;
				delete options.onclick;
			}
			gp.options = {...gp.options,...options};
			var map = this.map;
			//apply updates
			for(var i in Object.keys(options)) {
				var key = Object.keys(options)[i];
				switch(key) {
					case "fillColor": map.setPaintProperty(gp.fillLayer,"fill-color",gp.options[key]); break;
					case "fillOpacity":	map.setPaintProperty(gp.fillLayer,"fill-opacity",gp.options[key]); break;
					case "strokeColor": map.setPaintProperty(gp.strokeLayer,"line-color",gp.options[key]); break;
					case "strokeWeight": map.setPaintProperty(gp.strokeLayer,"line-width",gp.options[key]); break;
					case "strokeOpacity": map.setPaintProperty(gp.strokeLayer,"line-opacity",gp.options[key]); break;
					case "visible": 
						var fill_visible = true;
						if(!gp.options.fill) fill_visible = false;
						if(!gp.options.visible) fill_visible = false;
						map.setLayoutProperty(gp.fillLayer,"visibility", fill_visible?"visible":"none");
						var stroke_visible = true;
						if(!gp.options.stroke) stroke_visible = false;
						if(!gp.options.visible) stroke_visible = false;
						map.setLayoutProperty(gp.strokeLayer,"visibility", stroke_visible?"visible":"none");					
					break;
					case "fill": 
						var fill_visible = true;
						if(!gp.options.fill) fill_visible = false;
						if(!gp.options.visible) fill_visible = false;
						map.setLayoutProperty(gp.fillLayer,"visibility", fill_visible?"visible":"none");
					break;
					case "stroke": 
						var stroke_visible = true;
						if(!gp.options.stroke) stroke_visible = false;
						if(!gp.options.visible) stroke_visible = false;
						map.setLayoutProperty(gp.strokeLayer,"visibility", stroke_visible?"visible":"none");					
					break;
				}	
			}
			var fill_visible = true;
			if(!gp.options.fill) fill_visible = false;
			if(!gp.options.visible) fill_visible = false;
			var fillLayer = {
				'id': gp.fillLayer,
				'type': 'fill',
				'source': gp.id, 
				'layout': {
					'visibility': fill_visible?"visible":"none"
				},
				'paint': {
					'fill-color': gp.options.fillColor, 
					'fill-opacity': gp.options.fillOpacity
				}
			};
			//we have to redefine these because pulling them from mapbox
			//gives invalid values.
			this.mGL_ui.caches.updateLayer(fillLayer);
			var stroke_visible = true;
			if(!gp.options.stroke) stroke_visible = false;
			if(!gp.options.visible) stroke_visible = false; 

			var strokeLayer = {
				'id': gp.id+"_stroke",
				'type': 'line',
				'source': gp.id,
				'layout': {
					'visibility': stroke_visible?"visible":"none"
				},
				'paint': {
					'line-color': gp.options.strokeColor,
					'line-width': gp.options.strokeWeight,
					'line-opacity': gp.options.strokeOpacity,
				}
			};
			this.mGL_ui.caches.updateLayer(strokeLayer);

			if(typeof _onclick !="undefined") {
				//this does not really work right. the .off functions are NOT actually
				//removing the previous events. which causes them either to try and still fire,
				//or any new events to fire multiple times. 
				if(typeof gp.options.onclick=="function") {
					if(_clickLayer=="fill") {
						var clickLayer = gp.fillLayer;
					} else if(gp.options.clickLayer == "stroke") {
						var clickLayer = gp.strokeLayer;
					}
					map.off('click',clickLayer,gp.options.onclick);
					gp.options.onclick = _onclick;
					map.on('click',clickLayer,function(e) {
						if(typeof gp.options.onclick == "function") {
							gp.options.onclick.call(gc,e);
						}
					})
				} else {
					if(_clickLayer=="fill") {
						var clickLayer = gp.fillLayer;
					} else if(_clickLayer == "stroke") {
						var clickLayer = gp.strokeLayer;
					}
					map.off('click',clickLayer,gp.options.onclick);
					gp.options.onclick = false;
				}
			}
		}

		//alias for setOptions (for Leaflet compatibility)
		gp.setStyle = function(options) {
			gp.setOptions(options);
		}

		//create layers
		gp.draw();

		//return object
		return gp;
	}

	/* 
	* A wrapper for drawing a Great Circle in MapboxGL using the polygon class.
	*/
	circle(latLng,options = {}) {
		var map = this.map;
		var circle = {};
		circle.map = map;
		circle.mGL_ui = this;
		var defaults = {
			id: "circle_"+this.util.randomKey(), //internal id -- will be random if not set
			radius: undefined,
			fillColor:  "#0080ff",
			fillOpacity: 0.5,
			strokeColor: "#000000",
			strokeWeight: 3,
			strokeOpacity: 1.0,
			relativeCoordinates: false,
			visible: true,
			fill: true,
			stroke: true,
			bound: options.bound?options.bound:(options.boundObject?true:false),
			boundObject: undefined,
			onclick: false,
			clickLayer: "fill",
			beforeId: undefined,
			zindex: this.objectCount,
		}
		circle.position = latLng;
		circle.options = {...defaults,...options}
		circle.radius = options.radius;
		circle.id = circle.options.id;
		if(typeof circle.position == "undefined") { console.log("mGL circle: No position specified!"); return false; }
		if(typeof circle.radius == "undefined") { console.log("mGL circle: No radius specified!"); return false; }
		
		circle.draw = function () {
			var map = this.map;
			if(circle.options.relativeCoordinates) {
				circle.options.relativePosition = circle.position;
				circle.coords = this.mGL_ui.util.greatCirclePoints([0,0],circle.radius,{mapZoom:map.getZoom(), LngLat: true});
				console.log(circle.coords);
				circle.polygon = this.mGL_ui.polygon(circle.coords,circle.options);
			} else {
				circle.coords = this.mGL_ui.util.greatCirclePoints(circle.position,circle.radius,{mapZoom:map.getZoom(), LngLat: true});
				circle.polygon = this.mGL_ui.polygon(circle.coords,circle.options);
			}
		}

		/* Sets the center position with lat and lng */
		circle.setLatLng = function(latLng) {
			if(Array.isArray(latLng)) {
				circle.position = latLng;
			} else if(typeof latLng=="object") { 
				if(latLng.lng != undefined) {
					circle.position = [latLng.lat,latLng.lng];
				} else if(latLng.lon!=undefined) {
					circle.position = [latLng.lat,latLng.lon];					
				} else {
					console.log("Invalid position passed to circle.setLatLng:",latLng);
				}
			} else {
				console.log("Invalid position passed to circle.setLatLng:",latLng);
			}
			circle.redraw();
		}
		circle.setLatLon = function(latLon) {
			circle.setLatLng(latLon);
		}

		/* Sets the center position with lng and lat */
		circle.setLngLat = function(lngLat) {
			if(Array.isArray(lngLat)) {
				circle.position = [lngLat[1],lngLat[0]];
			} else if(typeof lngLat=="object") { 
				if(lngLat.lng != undefined) {
					circle.position = [lngLat.lat,lngLat.lng];
				} else if(lngLat.lon!=undefined) {
					circle.position = [lngLat.lat,lngLat.lon];
				} else {
					console.log("Invalid position passed to circle.setLngLat:",lngLat);
				}
			} else {
				console.log("Invalid position passed to circle.setLngLat:",lngLat);
			}
			circle.redraw();
		}
		
		/* Returns the current position of circle */
		circle.getLatLng = function() { return circle.position; }
		
		circle.redraw = function() {
			var map = this.map;
			circle.coords = this.mGL_ui.util.greatCirclePoints(circle.position,circle.radius,{mapZoom:map.getZoom(), LngLat: true});
			circle.polygon.coordinates = circle.coords;
			circle.polygon.redraw();
		}

		/* Changes the radius of the circle */
		circle.setRadius = function(radius) {
			if(typeof radius=="undefined") { console.log("mGl.circle: No radius specified!"); return false; }
			circle.radius = radius;
			circle.redraw();
		}

		/* Gets the radius of the circle */
		circle.getRadius = function() { return circle.radius; }

		/* Sets the options of the circle */
		circle.setOptions = function(options) {
			circle.polygon.setOptions(options);	
			circle.options = {...circle.options,...options};
		}

		circle.on = function(event,func) {
			circle.polygon.on(event,func);
		}
		circle.off = function(event,func) {
			circle.polygon.off(event,func);
		}

		circle.getBounds = function() { 
			return circle.polygon.getBounds();
		}

		/* Removes the circle */
		circle.remove = function() {
			circle.polygon.remove();
			if(typeof circle.options.boundObject != "undefined" && typeof circle.options.boundObject.bindings !="undefined") {
				var b = [];
				for(var i in circle.options.boundObject.bindings) {
					if(circle.options.boundObject.bindings[i].id!=circle.id) {
						b.push(circle.options.boundObject.bindings[i]);
					}
				}
				circle.options.boundObject.bindings = b;
			}
		}

		circle.draw();

		/* Set bindings */
		if(typeof circle.options.boundObject !="undefined") {
			if(typeof circle.options.boundObject.bindings == "undefined") circle.options.boundObject.bindings = [];
			circle.options.boundObject.bindings.push(circle);
			circle.bound = circle.options.bound;
		}
		return circle;
	}

}