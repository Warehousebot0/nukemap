/* 
 * Platform agnostic approach to the mapping functions used by NUKEMAP. 
 * Actual function translations are found in other library files which are
 * writing to a global called mapUI_functions[mode].
 */

var mapUI = function(options,onready) {
	if(typeof options.library=="function") {
		this.mode = options.library();
	} else {
		this.mode = options.library;
	}
	this.webGLsupported = webGLsupported();
	if(typeof options.hd=="function") {
		this.hd = options.hd();
	} else {
		this.hd = options.hd;
	}
	this.options = options;

	if(typeof mapUI_modes[this.mode] == "undefined") {
		alert("Invalid mode specified for maps: "+this.mode);
		console.error("Invalid mode specified for maps: "+this.mode);
		return false;
	}
	this.mm = mapUI_modes[this.mode](this);

	this.js = this.mm.js; //core JS files 
	this.css = this.mm.css; //CSS files 
	this.json = this.mm.json; //JSON files 
	this.plugins = this.mm.plugins; //any JS files that need to be loaded after core
	this.images = this.mm.images; //any images to preload
	this.errors = []; //place to store error messages

	/* Converts any lat,lon input format to {lat,lon} */
	this.latLon = (pos,func) => { return this.mm.latLon(pos,func) };
	/* Applies this.latLon to every item in an Array. */
	this.latLons = (array,func) => {
		var out = [];
		for(i in array) {
			var pos = array[i];
			if(Array.isArray(pos)) {
				if(pos.length==2 && Array.isArray(pos[0])==false) { 
					out.push(this.latLon(pos,func)); //just a [lat,lon]
				} else {
					out.push(this.latLons(pos,func)); //an array of other coordinates
				}
			} else {
				out.push(this.latLon(pos,func));
			}
		}
		return out;
	}
	/* This function translates any latLon coordinates returned by 
	 * this.latLon into whatever coordinate system is needed for the library. */
	this.ll = (latLon) => { return this.mm.ll(latLon); };
	/* Same as the above, but applies it to an array of latLons */
	this.lls = (array) => {
		var out = [];
		for(i in array) {
			var latLon = array[i];
			if(Array.isArray(latLon)) {
				out.push(this.lls(latLon));
			} else {
				out.push(this.ll(latLon));
			}
		}
		return out;
	}

	/* A helper function that will rename the keys in a given object.
	 * `object` is the object to operate on, `keylist` in an array of the form
	 * [[oldkey1,newkey1],[oldkey2,newkey2]]. If `deleteOld` is true it will 
	 * actually delete the old entry, if not, it will preserve them. */
	this.translate = function(obj,keylist,deleteOld = true ) {
		for(var i in keylist) {
			if(Object.keys(obj).includes(keylist[i][0])) {
				if(Array.isArray(obj[keylist[i][0]])) {
					obj[keylist[i][1]] = [...obj[keylist[i][0]]];
				} else if(typeof obj[keylist[i][0]]=="object") {
					obj[keylist[i][1]] = {...obj[keylist[i][0]]};
				} else {
					obj[keylist[i][1]] = obj[keylist[i][0]];
				}
				if(deleteOld) delete obj[keylist[i][0]];
			}
		}
		return obj;
	}

	/* Generates a random string */
	this.randomKey = function() {
		return Math.round((Math.random() * 1e18)).toString(36).substr(0, 10);
	}
	/* Generates a hash from a given string */
	this.hash = function(str) {
		var hash = 0, i, chr;
		if (str.length === 0) return hash;
		for (i = 0; i < str.length; i++) {
			chr = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + chr;
			hash |= 0; // Convert to 32bit integer
		}
		return hash;
	}

	/* MAP OBJECT  */

	/* Map instance initiator */
	this.map = undefined; //always assigned to the map object

	/* Creates of a new map object */
	this.initMap = (mapOptions,onLoad,onError) => {
		if(DEBUG) console.log("mapUI initMap try");
		try {	
			this.map = new this.mapObject(this,mapOptions,onLoad,onError);
		} catch(err) {
			if(DEBUG) console.log("mapUI initMap failed",err);
			if(typeof onError=="function") {
				onError(err);
				return undefined;
			} else {
				console.error(err);
				return undefined;
			}
		}
		if(DEBUG) console.log("mapUI initMap success",this.map.loaded,this.map.onloaded);
		//This will call onload if these properties have been set -- useful in some cases?
		if(this.map._map.do_onload) {
			if(typeof onLoad=="function") onLoad(this.map);
		}
		if(this.options.session) {
			this.session = this.options.session;
		} else {
			this.session = this.randomKey();
		}
		return this.map;
	}

	this.mapObject = function(mapUI,mapOptions,onLoad,onError) {	

		/* Sets the position and zoom of a map in one setting */
		this.setView = (latLon,zoom) => { return mapUI.mm.setView(this._map,mapUI.mm.latLon(latLon),zoom) }
		/* Returns the latLon for the center of the map in its current view */
		this.getCenter = ()=> { return mapUI.mm.getCenter(this._map) }
		/* Alias of getCenter */
		this.getLatLon = ()=> { return this.getCenter() }
		/* Sets the center of the map to latLon */
		this.panTo = (latLon,animate) => { mapUI.mm.panTo(this._map,mapUI.mm.latLon(latLon),animate) }
		/* Aliases of panTo */
		this.setCenter = (latLon,animate) => { this.panTo(latLon,animate) }
		this.setLatLon = (latLon,animate) => { this.panTo(latLon,animate) }
		/* Returns the current zoom level of the map */
		this.getZoom = () => { return mapUI.mm.getZoom(this._map) }
		/* Sets the current zoom level of the map */
		this.zoomTo = (zoom,animate) => { mapUI.mm.zoomTo(this._map,zoom,animate) }
		this.setZoom = (zoom,animate) => { this.zoomTo(zoom,animate) }
		/* Zooms/pans to bounds */
		this.fitBounds = (bounds,padding) => { mapUI.mm.fitBounds(this._map,bounds,padding)}

		this.eventOn = (event,func,eventid="") => { return mapUI.eventOn(this._map,event,func,eventid,this); }
		this.eventOff = (event,eventid="") => { return mapUI.eventOff(this._map,event,eventid,this); }
		this.eventTrigger = (event,eventid="") => { return mapUI.eventTrigger(this._map,event,eventid,this); }
		this.eventsClear = () => { return mapUI.eventsClear(this._map); }

		this._map = mapUI.mm.loadMap(mapOptions,onLoad,onError);
		this._map.mapObj = this;
		return this;
	}

	/* MARKERS */

	/* Creates a new marker object that binds to the translation functions */
	this.marker = (markerOptions)=>{ 
		return new this.markerObject(this,markerOptions);
	}

	/* This is a sort of pseudo-object that makes it easier to use the marker by
	 * binding the individual functions, handlers, etc., as objects. */
	this.markerObject = function(mapUI, markerOptions) {
		this.bindings = [];
		this._marker = mapUI.mm.marker(markerOptions);
		if(this._marker.marker) {
			if(this._marker.shadow) {
				this.shadow = this._marker.shadow;
				this.shadow.bound = true;
				this.shadow.mousedown = this.shadow._marker.mousedown;
				this.bindings.push(this.shadow);
			}
			this._marker = this._marker.marker;
		}
		this._marker.obj = this;
		if(markerOptions.icon && markerOptions.icon.mousedown) {
			this.mousedown = markerOptions.icon.mousedown;
		}
		this.remove = ()=> { 
			this.eventsClear(); 
			mapUI.mm.markerRemove(this._marker); 

			if(this.shadow) this.shadow.remove();
			return undefined;
		}

		this.getLatLon = ()=> { return mapUI.mm.markerGetLatLon(this._marker,this); }
		this.setLatLon = (latLon)=> { mapUI.mm.markerSetLatLon(this._marker,mapUI.mm.latLon(latLon),this); }

		this.eventOn = (event,func,eventid) => { return mapUI.eventOn(this._marker,event,func,eventid,this); }
		this.eventOff = (event,eventid) => { return mapUI.eventOff(this._marker,event,eventid,this); }
		this.eventTrigger = (event,eventid="") => { return mapUI.eventTrigger(this._marker,event,eventid,this); }
		this.eventsClear = () => { return mapUI.eventsClear(this._marker) }

		this.css = (property,value) => { return mapUI.mm.markerCSS(this._marker,property,value,this);}
		this.getIcon = () => { return mapUI.mm.markerGetIcon(this._marker,this); }
		this.setIcon = (markerIcon) => { mapUI.mm.markerSetIcon(this._marker,markerIcon,this); }
		this.getTitle = () => { return mapUI.mm.markerGetTitle(this._marker,this); }
		this.setTitle = (title) => { mapUI.mm.markerSetTitle(this._marker,title,this); }
		this.getPopup = () => { return mapUI.mm.markerGetPopup(this._marker,this); }
		this.setPopup = (html) => { mapUI.mm.markerSetPopup(this._marker,html,this); }
		this.openPopup = (html,options) => { mapUI.mm.markerOpenPopup(this._marker,html,this); }
		this.closePopup = () => {mapUI.mm.markerClosePopup(this._marker,this); }

		/* Generic drag function that checks for bindings */
		this.eventOn("drag",(e)=>{
			if(typeof markerOptions.ondrag == "function") {
				var override = markerOptions.ondrag.call(mapUI,marker,e);
			}
			if(override === true) return false;
			var latLon = this.getLatLon();
			for(var i in this.bindings) {
				if(this.bindings[i].bound) {
					if(typeof this.bindings[i].obj != "undefined") {
						this.bindings[i].obj.setLatLon(latLon);
					} else {
						this.bindings[i].setLatLon(latLon);
					}
				}
			}
		})
		
		/* Special generic mousedown function for markers */
		if(this.mousedown || (this.shadow&&this.shadow.mousedown) && !this.is_shadow) {
			this.eventOn("mousedown",()=>{
				if(this.mousedown) {
					if(this.mousedown.offset) {
						if(!this.mousedown._offset) this.mousedown._offset = parseFloat($(this.getIcon()).css("margin-top"));
						$(this.getIcon()).css("margin-top",this.mousedown._offset+parseFloat(this.mousedown.offset)+"px");
					}
					if(this.mousedown.className) {
						$(this.getIcon()).addClass(this.mousedown.className)
					}
				}
				if(this.shadow && this.shadow.mousedown) {
					if(this.shadow.mousedown.className) {
						$(this.shadow.getIcon()).addClass(this.shadow.mousedown.className)
					}
				}
			})
			this.eventOn(["mouseup","dragend"],()=> {
				if(this.mousedown) {
					if(this.mousedown._offset) {
						$(this.getIcon()).css("margin-top",this.mousedown._offset+"px");
					}
					if(this.mousedown.className) {
						$(this.getIcon()).removeClass(this.mousedown.className)
					}
				}
				if(this.shadow && this.shadow.mousedown) {
					if(this.shadow.mousedown.className) {
						$(this.shadow.getIcon()).removeClass(this.shadow.mousedown.className)
					}
				}
			})
		}
		return this;
	}
	this.markerIcon = (iconOptions) => { return this.mm.markerNewIcon(iconOptions);}


	/* CIRCLES */
	
	this.circle = (circleOptions)=> {
		return new this.circleObject(this,circleOptions);
	}

	this.circleObject = function(mapUI, circleOptions) {
		this._circle = mapUI.mm.circle(circleOptions,mapUI);
		this._circle.obj = this;
		this.remove = () => { this.eventsClear(); mapUI.mm.circleRemove(this._circle); return undefined; }
		this.getLatLon = () => { return mapUI.mm.circleGetLatLon(this._circle,this); }
		this.setLatLon = (latLon) => { mapUI.mm.circleSetLatLon(this._circle,mapUI.mm.latLon(latLon),this); }
		this.getRadius = () => { return mapUI.mm.circleGetRadius(this._circle,this); }
		this.setRadius = (radius) => { mapUI.mm.circleSetRadius(this._circle,radius,this); }
		this.setOptions = (circleOptions) => { mapUI.mm.circleSetOptions(this._circle,circleOptions,this); }
		this.getBounds = () => { return mapUI.mm.circleGetBounds(this._circle,this); }
		this.getProperty = (property) => { return mapUI.mm.circleGetProperty(this._circle,property,this); }

		this.redraw = () => { mapUI.mm.circleRedraw(this._polygo,this) }

		this.eventOn = (event,func,eventid) => { return mapUI.eventOn(this._circle,event,func,eventid,this); }
		this.eventOff = (event,eventid) => { return mapUI.eventOff(this._circle,event,eventid,this); }
		this.eventTrigger = (event,eventid) => { return mapUI.eventTrigger(this._circle,event,eventid,this); }
		this.eventsClear = () => { return mapUI.eventsClear(this._circle,this); }


		return this;
	}

	/* POLYGON */
	this.polygon = (polygonOptions)=> {
		return new this.polygonObject(this,polygonOptions);
	}

	this.polygonObject = function(mapUI, polygonOptions) {
		this._polygon = mapUI.mm.polygon(polygonOptions);
		this._polygon.obj = this;
		this.remove = () => { this.eventsClear(); mapUI.mm.polygonRemove(this._polygon); return undefined; }
		this.getCenter = () => { return mapUI.mm.polygonGetCenter(this._polygon,this); }
		this.getLatLons = () => { return mapUI.mm.polygonGetLatLons(this._polygon,this); }
		this.setLatLons = (latLons) => { mapUI.mm.polygonSetLatLons(this._polygon,latLons,this); }
		this.isEmpty = () => { return mapUI.mm.polygonIsEmpty(this._polygon,this); }
		this.addLatLon = (latLon) => { mapUI.mm.polygonAddLatLon(this._polygon,latLon,this); }
		this.setOptions = (polygonOptions) => { mapUI.mm.polygonSetOptions(this._polygon,polygonOptions,this); }
		this.getBounds = () => { return mapUI.mm.polygonGetBounds(this._polygon,this); }
		this.getProperty = (property) => { return mapUI.mm.polygonGetProperty(this._polygon,property,this); }

		this.redraw = () => { mapUI.mm.polygonRedraw(this._polygo,this) }

		this.eventOn = (event,func,eventid) => { return mapUI.eventOn(this._polygon,event,func,eventid,this); }
		this.eventOff = (event,eventid) => { return mapUI.eventOff(this._polygon,event,eventid,this); }
		this.eventTrigger = (event,eventid) => { return mapUI.eventTrigger(this._polygon,event,eventid,this); }
		this.eventsClear = () => { return mapUI.eventsClear(this._polygon,this); }

		return this;
	}
	
	/* CONTROLS */

	/* Accesses any layers defined in settings. */
	this.baseLayers = () => { 
		if(typeof this.mm.baseLayers=="function") {
			return this.mm.baseLayers();
		} else {
			return this.mm.baseLayers; 
		}
	}

	/* Adds a layer control. Actual layers are determined by settings; options sets position, etc. */
	this.addLayerControl = (options) => {
		this.mm.addLayerControl(options,this);
	}
	this.addZoomControl = (options) => {
		this.mm.addZoomControl(options,this);
	}
	this.addScaleControl = (options) => {
		this.mm.addScaleControl(options,this);
	}
	this.removeScaleControl = () => {
		this.mm.removeScaleControl(this);
	}
	this.updateScaleControl = (units) => {
		this.mm.updateScaleControl(units,this);
	}

	/* Converts a pixel position of the map to a LatLon */
	this.pixelToLatLon = (px,py) => {
		return this.mm.pixelToLatLon([px,py]);
	};

	/* Extracts the lat/lon of the cursor from a mouse event */
	this.mouseEventLatLon = (e) => {
		return this.mm.mouseEventLatLon(e);
	}


	/* MAP EVENT HANDLERS */

	/* Fires when the map has totally loaded and is ready to manipulate. Note that this must
	 * be set BEFORE loadMap() is called.*/
	this.onLoad = (func) => { return this.mm.onLoad(func); };
	this.offLoad = () => { return this.mm.offLoad(); };

	/* Function that fires when the user begins to move the map */
	this.onMoveStart = (func) => { return this.mm.onMoveStart(func) }
	this.offMoveStart = () => { return this.mm.offMoveStart(); };
	/* Function that fires contiually as the map is being moved */
	this.onMove = (func) => { return this.mm.onMove(func) }
	this.offMove = () => { return this.mm.offMove(); };
	/* Function that fires when the map has stopped moving */
	this.onMoveEnd = (func) => { return this.mm.onMoveEnd(func) }
	this.offMoveEnd = () => { return this.mm.offMoveEnd(); };

	/* Mouse functions */
	this.onClick = (func) => { return this.mm.onClick(func) }
	this.offClick = () => { return this.mm.offClick(); };
	this.onDblClick = (func) => { return this.mm.onDblClick(func) }
	this.offDblClick = () => { return this.mm.offDblClick(); };
	this.onMouseDown = (func) => { return this.mm.onMouseDown(func) }
	this.offMouseDown = () => { return this.mm.offMouseDown(); };
	this.onMouseUp = (func) => { return this.mm.onMouseUp(func) }
	this.offMouseUp = () => { return this.mm.offMouseUp(); };
	this.onMouseOver = (func) => { return this.mm.onMouseOver(func) }
	this.offMouseOver= () => { return this.mm.offMouseOver(); };
	this.onMouseOut = (func) => { return this.mm.onMouseOut(func) }
	this.offMouseOut= () => { return this.mm.offMouseOut(); };
	this.onMouseMove = (func) => { return this.mm.onMouseMove(func) }
	this.offMouseMove = () => { return this.mm.offMouseMove(); };

	/* General event system */
	this._events = {};
	this.eventOn = (subject,event_name,event_function,event_id,object) => {
		if(Array.isArray(event_name)) {
			var rets = [];
			for(var i in event_name) {
				rets.push(this.eventOn(subject,event_name[i],event_function,event_id,object));
			}
			return rets;
		}
		var translateEvent = this.mm.translateEvent(subject,event_name);
		var target_subject = subject;
		var target_event_name = event_name;
		var target_subject_eventid = subject._eventid;
		if(typeof translateEvent=="string") {
			target_event_name = translateEvent;
		} else if(typeof translateEvent == "object") {
			target_subject = translateEvent.subject;
			target_subject_eventid = translateEvent.subject_eventid
			target_event_name = translateEvent.event_name;
		}
		if(typeof this._events[subject._eventid] == "undefined") {
			this._events[subject._eventid] = {};
			this._events[subject._eventid]._id = subject.id;
		}
		if(typeof this._events[subject._eventid][event_name] == "undefined") {
			this._events[subject._eventid][event_name] = {};
		}
		if(!event_id) event_id = this.hash(event_function.toString()); 
		if(typeof this._events[subject._eventid][event_name][event_id] == "undefined") { //avoid duplication
			this._events[subject._eventid][event_name][event_id] = {
				event_function: event_function,
				target: {
					subject: target_subject,
					event: target_event_name
				}
			}
			this.mm.eventOn(target_subject,target_event_name,this._events[subject._eventid][event_name][event_id].event_function);
			return this._events[subject._eventid][event_name][event_id];
		}
	}
	this.eventOff = (subject,event_name,event_id="",object) => {
		if(Array.isArray(event_name)) {
			var rets = [];
			for(var i in event_name) {
				rets.push(this.eventOff(subject,event_name[i],event_id,object));
			}
			return rets;
		}
		var translateEvent = this.mm.translateEvent(subject,event_name);
		var target_subject = subject;
		var target_event_name = event_name;
		var target_subject_eventid = subject._eventid;
		if(typeof translateEvent=="string") {
			target_event_name = translateEvent;
		} else if(typeof translateEvent == "object") {
			target_subject = translateEvent.subject;
			target_subject_eventid = translateEvent.subject_eventid
			target_event_name = translateEvent.event_name;
		}
		if(this._events[subject._eventid]==undefined || this._events[subject._eventid][event_name] == undefined) {
			return false;
		}
		if(event_id) {
			if(this._events[subject._eventid][event_name][event_id]==undefined) {
				return false;
			} else {
				this.mm.eventOff(target_subject,target_event_name,this._events[subject._eventid][event_name][event_id].event_function);
				delete this._events[subject._eventid][event_name][event_id];	
				return true;
			}
		} else {
			for(var i in Object.keys(this._events[subject._eventid][event_name])) {
				var event_id = Object.keys(this._events[subject._eventid][event_name])[i];
				this.mm.eventOff(target_subject,target_event_name,this._events[subject._eventid][event_name][event_id].event_function);
				delete this._events[subject._eventid][event_name][event_id];	
			}
			return true;
		}
	}
	this.eventTrigger = (subject,event_name,event_id="",object) => {
		if(Array.isArray(event_name)) {
			var rets = [];
			for(var i in event_name) {
				rets.push(this.eventTrigger(subject,event_name[i],event_id,object));
			}
			return rets;
		}
		var translateEvent = this.mm.translateEvent(subject,event_name);
		var target_subject = subject;
		var target_event_name = event_name;
		var target_subject_eventid = subject._eventid;
		if(typeof translateEvent=="string") {
			target_event_name = translateEvent;
		} else if(typeof translateEvent == "object") {
			target_subject = translateEvent.subject;
			target_subject_eventid = translateEvent.subject_eventid
			target_event_name = translateEvent.event_name;
		}
		if(this._events[subject._eventid]==undefined || this._events[subject._eventid][event_name] == undefined) {
			return undefined;
		}
		if(event_id) {
			if(this._events[subject._eventid][event_name][event_id]==undefined) {
				return undefined;
			} else {
				return this._events[subject._eventid][event_name][event_id].event_function();
			}
		} else {
			if(Object.keys(this._events[subject._eventid][event_name]).length>1) {
				var rets = [];
			}
			for(var i in Object.keys(this._events[subject._eventid][event_name])) {
				var event_id = Object.keys(this._events[subject._eventid][event_name])[i];
				if(rets) {
					rets.push(this._events[subject._eventid][event_name][event_id].event_function());
				} else {
					return this._events[subject._eventid][event_name][event_id].event_function()
				}
			}
			return rets;
		}
	}
	this.eventsClear = (subject,object) => {
		if(typeof this._events[subject._eventid] == "undefined") {
			return true;
		}
		for(var en in Object.keys(this._events[subject._eventid])) {
			var event_name = Object.keys(this._events[subject._eventid])[en];
			for(var ei in Object.keys(this._events[subject._eventid][event_name])) {
				var event_id = Object.keys(this._events[subject._eventid][event_name])[ei];
				this.eventOff(subject,event_name,event_id);
			}
		}
		delete this._events[subject._eventid];
		return true;
	}




	/* Initialization functions */

	this._js = []; this._css = []; this._json = {}; //when actually loaded
	this.loadJS = (js,onload,onerror) => {
		for(var i in js) {
			var script = document.createElement("script");
			script.type = "text/javascript";
			script.onload = function() {
				if(typeof onload == "function") onload(this.src);
			}
			script.onerror = function(e) {
				if(typeof onerror == "function") onerror(this.src)
			}
			script.src = js[i];
			document.querySelector("head").appendChild(script);
		}
	}
	this.loadCSS = function(css,onload,onerror) {
		for(var i in css) {
			var link = document.createElement("link");
			link.rel = "stylesheet";
			link.onload = function() {
				if(typeof onload =="function") onload(this.href);
			}
			link.onerror = function() {
				if(typeof onerror =="function") onerror(this.href);
			}
			link.href = css[i];
			document.querySelector("head").appendChild(link);		
		}
	}
	this.loadJSON = function(json,onload,onerror) {
		for(var i in json) {
			$.ajax({
				dataType: "json",
				url: json[i].url,
				_vars: {
					json: json[i],
					url: json[i].url,
					mm: this.mm,
					onload: onload,
					onerror: onerror
				},				
				success: function(data,status,jqXHR) {
					if(DEBUG) console.log("loadJSON",this._vars["json"]);
					if(typeof this._vars["json"].onload == "function") this._vars["json"].onload.call(this._vars["mm"],data);
					if(typeof this._vars["onload"]=="function") this._vars["onload"].call(this._vars["mm"],data);
				},
				error: function(err) {
					if(DEBUG) console.log(`Could not load or parse JSON file`,err,this);
					if(typeof this._vars["onerror"]=="function") this._vars["onerror"].call(this._vars["mm"],this._vars["url"]);
				}
			});
		}	
	}
	/* Loads all images in the images object or array. Stores the actual image
	 * data in this._loadImages, which is probably unnecessary but might keep the
	 * browser from dumping the data for the ones that aren't otherwise used. 
	 */
	this.loadImages = function(images,onload) {
		if(Array.isArray(images)) {
			if(this._loadImages == undefined) this._loadImages = [];
			var arr = images;
		} else {
			if(this._loadImages == undefined) this._loadImages = {};
			var arr = Object.keys(images);
		}
		for(var i in arr) {
			if(Array.isArray(images)) {
				var key = this._loadImages.length;
				var url = images[i];
			} else {
				var key =	arr[i];
				var url = images[arr[i]];
			}
			this._loadImages[key] = new Image();
			this._loadImages[key].onload = function(e) {
				onload(this,e);
			}
			this._loadImages[key].src = url;
		}
	}

	//registers when all files have loaded.
	this.mapfilesLoaded = ()=> {
		if(DEBUG) console.log("all main map files loaded");
		if(this.plugins.length) {
			this.total_mapfiles+=Object.keys(this.plugins).length;
			if(DEBUG) console.log("loading supplemental plugins");
			this.loadJS(this.plugins,(href)=> {
				this._js.push(href);
				this.loaded_mapfiles++;
				if(typeof this.options.onloadprogress == "function") {
					this.options.onloadprogress.call(this,this.loaded_mapfiles,this.total_mapfiles,href);
				}	
				if(this.loaded_mapfiles==this.total_mapfiles) {	
					if(typeof this.options.onloaddone == "function") {
						this.options.onloaddone.call(this,this.loaded_mapfiles,this.total_mapfiles);
					}
					if(typeof this.mm.onready == "function") {
						this.mm.onready.call(this,onready);
					} else {
						onready(this);
					}
				}
			},(href)=>{
				if(DEBUG) console.log("Failed to load mapfile",href);
				this.errors.push("Download failed: "+href);
			})
		} else {
			if(typeof this.options.onloaddone == "function") {
				this.options.onloaddone.call(this,this.loaded_mapfiles,this.total_mapfiles);
			}
			if(typeof this.mm.onready == "function") {
				this.mm.onready.call(this,onready);
			} else {
				onready(this);
			}
		}
	}

	/* preload necessary scripts for this mode */
	this.total_mapfiles = Object.keys(this.js).length +  Object.keys(this.css).length + Object.keys(this.json).length + Object.keys(this.images).length;
	this.loaded_mapfiles = 0;
	if(DEBUG) console.log(this.total_mapfiles+" files to load");
	if(typeof this.options.onloadstart == "function") {
		this.options.onloadstart.call(this,this.total_mapfiles);
	}
	if(this.total_mapfiles==0) {
		this.mapfilesLoaded();
	} else {
		this.loadJS(this.js,(href)=> {
			this._js.push(href);
			this.loaded_mapfiles++;
			if(typeof this.options.onloadprogress == "function") {
				this.options.onloadprogress.call(this,this.loaded_mapfiles,this.total_mapfiles,href);
			}
			if(this.loaded_mapfiles==this.total_mapfiles) this.mapfilesLoaded();
		},(href)=> {
			if(DEBUG) console.log("Failed to load mapfile",href);
			this.errors.push(["missing",href]);		
		})
		this.loadCSS(this.css,(href)=> {
			this.loaded_mapfiles++;
			this._css.push(href);
			if(typeof this.options.onloadprogress == "function") {
				this.options.onloadprogress.call(this,this.loaded_mapfiles,this.total_mapfiles,href);
			}
			if(this.loaded_mapfiles==this.total_mapfiles) this.mapfilesLoaded();
		},(href)=> {
			if(DEBUG) console.log("Failed to load mapfile",href);
			this.errors.push(["missing",href]);		
		})
		this.loadJSON(this.json,(json,data)=> {
			for(var i in this.json) {
				if(this.json[i].url==json.url) {
					json.id = this.json[i].id;
				}
			}
			this._json[json.id] = {data:data, url:json.url}
			this.loaded_mapfiles++;
			if(typeof this.options.onloadprogress == "function") {
				this.options.onloadprogress.call(this,this.loaded_mapfiles,this.total_mapfiles,json.url);
			}
			if(this.loaded_mapfiles==this.total_mapfiles) this.mapfilesLoaded();
		},(href)=> {
			if(DEBUG) console.log("Failed to load mapfile",href);
			this.errors.push(["missing",href]);		
		})
		this.loadImages(this.images,(img)=> {
			this.loaded_mapfiles++;
			if(typeof this.options.onloadprogress == "function") {
				this.options.onloadprogress.call(this,this.loaded_mapfiles,this.total_mapfiles,img.src);
			}
			if(this.loaded_mapfiles==this.total_mapfiles) this.mapfilesLoaded();
		},(href)=> {
			if(DEBUG) console.log("Failed to load mapfile",href);
			this.errors.push(["missing",href]);		
		})
	}	
	return this;
}

/* From https://maplibre.org/maplibre-gl-js/docs/examples/check-for-support/*/
/* Note that this should not be run repeatedly! */
function webGLsupported() {
		if (window.WebGLRenderingContext) {
				const canvas = document.createElement('canvas');
				try {
						// Note that { failIfMajorPerformanceCaveat: true } can be passed as a second argument
						// to canvas.getContext(), causing the check to fail if hardware rendering is not available. See
						// https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
						// for more details.
						//const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
						const context = canvas.getContext('webgl2',{ failIfMajorPerformanceCaveat: true }) || canvas.getContext('webgl',{ failIfMajorPerformanceCaveat: true });
						if (context && typeof context.getParameter == 'function') {
								return true;
						}
				} catch (e) {
						// WebGL is supported, but disabled
				}
				return false;
		}
		// WebGL not supported
		return false;
}