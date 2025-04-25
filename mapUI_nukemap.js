/* mapUI library settings specific to NUKEMAP. 
 * is added to the mapUI initialization object.
 * separated out here because otherwise it's a lot to have in one setup object...
*/

mapUI_settings["raster-leaflet-protomaps"] = {
	json: [{
		id: "style_normal", 
		url: dynamicAssets+"mapdata/styles/?style=normal",
		onload:(d)=>{ if(!MAPUI.stylejson) MAPUI.stylejson = {}; MAPUI.stylejson["normal"] = d; }
	},
	{
		id: "style_satellite", 
		url: dynamicAssets+"mapdata/styles/?style=satellite",
		onload:(d)=>{ if(!MAPUI.stylejson) MAPUI.stylejson = {}; MAPUI.stylejson["satellite"] = d; }
	},
	{
		id: "style_dark", 
		url: dynamicAssets+"mapdata/styles/?style=dark",
		onload:(d)=>{ if(!MAPUI.stylejson) MAPUI.stylejson = {}; MAPUI.stylejson["dark"] = d; }
	}
	],
	plugins: [dynamicAssets+"mapdata/sources.js?r="+Math.random()],
	baseLayers: ()=> {
		if(!MAPUI.fonts) MAPUI.fonts = {
			"Lato Regular": {"face":"Lato", weight: 400},
			"Lato Bold": {"face": "Lato", weight: 800},
			"Lato Italic": {"face": "Lato", weight: 400, style: "italic"},
			"Lato Light": {"face": "Lato", weight: 200}
		};
		return pRasterLayers();
	},
	images: {
		markerIcon: imageAssets+"nukemap_marker.png",
		markerShadowIcon: imageAssets+"nukemap_marker_target.png",
		markerShadowIconSmall: imageAssets+"nukemap_marker_target_small.png",
		probeIcon: imageAssets+"probe.png",
		probeShadowIcon: imageAssets+"probe_base.png",
		windsockIcon: imageAssets+"windsock.svg",
		windsockShadowIcon: imageAssets+"windsock_base_arrow.png"
	},
	onmapload: function() {
		this.tiles_loaded = [];
		this.tiles_queued = [];
		//tile tracker -- only updates every three seconds avoid overload.
		setInterval(()=>{
			if(this.tiles_queued>0) {
				var t = [];
				for(var i in this.tiles_loaded) {
					t.push({p:this.tiles_loaded[i].p,s:this.tiles_loaded[i].s,c:this.tiles_loaded[i].c})
				}
				var d = {
					"s": this.mapUI.session,
					"t": t,
					"m": MAPUI.mode
				}
				for(var i in this.tiles_loaded) { this.tiles_loaded[i].c = 0};
				this.tiles_queued = 0;				
				$.ajax({
					type: "GET",
					url: dynamicAssets+"mapdata/tilecount2.php",
					data: d,
					error: function(data) {
						if(DEBUG) console.log("Error logging tilecount",data);
					}
				});
			}
		},3000);
	},	
	ontileloadstart: function(e) {
		//will be complete if read from memory, but not from disk
		if(e.tile.complete==false) {
			e.tile.from_cache = false;
			//record the current time
			e.tile.loadstarttime = window.performance.now();
		} else {
			e.tile.from_cache = true;
		}
	},
	ontileload: function(e) {
		if(!e.tile.from_cache) {
			var loadtime = window.performance.now()-e.tile.loadstarttime;
			//if the load time is <40ms then it is probably from disk cache
			if(loadtime>40) {
				var sourcekey = e.target.sourcekey;
				var provider = e.target.provider;
				if(this.tiles_loaded == undefined) this.tiles_loaded = [];
				var logged = false; 
				for(var i in this.tiles_loaded) {
					if(this.tiles_loaded[i].p==provider && this.tiles_loaded[i].s==sourcekey) {
						this.tiles_loaded[i].c++; logged = true;
					}
				}
				if(!logged) this.tiles_loaded.push({p:provider,s:sourcekey,c:1});
				this.tiles_queued++;
			}
		}
		},
	onbaselayerchangedone: function(e) {
		$("#wordmark").remove();
		if(e.layer.wordmark) {
			$('.leaflet-bottom.leaflet-left').append("<div class='leaflet-control' id='wordmark'>"+e.layer.wordmark+"</div>");
		}
	}}

mapUI_settings["raster-leaflet"] = {
	js: [dynamicAssets+"mapdata/sources.js?r="+Math.random()],
	images: {
		markerIcon: imageAssets+"nukemap_marker.png",
		markerShadowIcon: imageAssets+"nukemap_marker_target.png",
		markerShadowIconSmall: imageAssets+"nukemap_marker_target_small.png",
		probeIcon: imageAssets+"probe.png",
		probeShadowIcon: imageAssets+"probe_base.png",
		windsockIcon: imageAssets+"windsock.svg",
		windsockShadowIcon: imageAssets+"windsock_base_arrow.png"
	},
	baseLayers: ()=> {
		return rasterLayers;
	},
	onmapload: function() {
		this.tiles_loaded = [];
		this.tiles_queued = [];
		//tile tracker -- only updates every three seconds avoid overload.
		setInterval(()=>{
			if(this.tiles_queued>0) {
				var t = [];
				for(var i in this.tiles_loaded) {
					t.push({p:this.tiles_loaded[i].p,s:this.tiles_loaded[i].s,c:this.tiles_loaded[i].c})
				}
				var d = {
					"s": this.mapUI.session,
					"t": t,
					"m": MAPUI.mode
				}
				for(var i in this.tiles_loaded) { this.tiles_loaded[i].c = 0};
				this.tiles_queued = 0;				
				$.ajax({
					type: "GET",
					url: dynamicAssets+"mapdata/tilecount2.php",
					data: d,
					error: function(data) {
						if(DEBUG) console.log("Error logging tilecount",data);
					}
				});
			}
		},3000);
	},
	ontileloadstart: function(e) {
		//will be complete if read from memory, but not from disk
		if(e.tile.complete==false) {
			e.tile.from_cache = false;
			//record the current time
			e.tile.loadstarttime = window.performance.now();
		} else {
			e.tile.from_cache = true;
		}
	},
	ontileload: function(e) {
		if(!e.tile.from_cache) {
			var loadtime = window.performance.now()-e.tile.loadstarttime;
			//if the load time is <40ms then it is probably from disk cache
			if(loadtime>40) {
				var sourcekey = e.target.sourcekey;
				var provider = e.target.provider;
				if(this.tiles_loaded == undefined) this.tiles_loaded = [];
				var logged = false; 
				for(var i in this.tiles_loaded) {
					if(this.tiles_loaded[i].p==provider && this.tiles_loaded[i].s==sourcekey) {
						this.tiles_loaded[i].c++; logged = true;
					}
				}
				if(!logged) this.tiles_loaded.push({p:provider,s:sourcekey,c:1});
				this.tiles_queued++;
			}
		}
		},
	onbaselayerchangedone: function(e) {
		$("#wordmark").remove();
		if(e.layer.wordmark) {
			$('.leaflet-bottom.leaflet-left').append("<div class='leaflet-control' id='wordmark'>"+e.layer.wordmark+"</div>");
		}
	}
}

mapUI_settings["vector-maplibre"] = {
	js: [dynamicAssets+"mapdata/sources.js?r="+Math.random()],
	images: {
		markerIcon: imageAssets+"nukemap_marker.svg",
		markerShadowIcon: imageAssets+"nukemap_marker_target.svg",
		markerShadowIconSmall: imageAssets+"nukemap_marker_target_small.svg",
		probeIcon: imageAssets+"probe.svg",
		probeShadowIcon: imageAssets+"probe_base.svg",
		windsockIcon: imageAssets+"windsock.svg",
		windsockShadowIcon: imageAssets+"windsock_base_arrow.svg"
	},
	keys: {
		"bing": { key: "14009", search:"virtualearth"} //this seems to always be the right answer? API call will repopulate it but we don't have to wait
	},
	baseLayers: ()=> {
		return vectorLayers;
	},
	onmapload: function(e) {
		this.tiles_loaded = [];
		this.tiles_queued = [];
	
		if(this.baseLayers[this.defaultLayer].wordmark) {
			$("#wordmark").remove();
			$(".maplibregl-ctrl-bottom-left").append('<div class="maplibregl-ctrl" id="wordmark">'+this.baseLayers[this.defaultLayer].wordmark+'</div>');
		}
		if(this.baseLayers[this.defaultLayer].name=="Satellite") {
			if(this.mapUI.options.hd) {
				this.mapUI.map._map.setLayoutProperty("satellite_hd","visibility","visible");
			} else {
				this.mapUI.map._map.setLayoutProperty("satellite","visibility","visible");
			}
		}
		//create an empty layer for the circles and a layer for the fallout	
		//this is just so we can keep track of them sort of like z-indexes
		var falloutLayer = {
			id:"falloutLayer",
			type: "custom",
			render: ()=>{}
		}
		var circleLayer = {
			id:"circleLayer",
			type: "custom",
			render: ()=>{}
		};
		this.mapUI.map._map.addLayer(circleLayer);
		this.mGL.caches.updateLayer(circleLayer);
		this.mapUI.map._map.addLayer(falloutLayer);
		this.mGL.caches.updateLayer(falloutLayer);
		/* The part of the tile tracking system that flushes the queue every few seconds. */
		this.flush_tile_queue = () => {
			if(this.tiles_queued>0) {
				var t = [];
				for(var i in this.tiles_loaded) {
					t.push({p:this.tiles_loaded[i].p,s:this.tiles_loaded[i].s,c:this.tiles_loaded[i].c})
				}
				var d = {
					"s": this.mapUI.session,
					"t": t,
					"m": MAPUI.mode
				}
				for(var i in this.tiles_loaded) { this.tiles_loaded[i].c = 0};
				this.tiles_queued = 0;
				$.ajax({
					type: "GET",
					url: dynamicAssets+"mapdata/tilecount2.php",
					data: d,
					success: function(e) {
						//console.log("tilecount success",e);
					},
					complete: function(e) {
						//console.log("tilecount",e);
					},
					error: function(data) {
						if(DEBUG) console.log("Error logging tilecount",data);
					}
				});
			}
		}
		/* flush queue every few seconds */
		setInterval(()=>{
			this.flush_tile_queue();
		},3000);
		/* unlikely to work... */
		window.onbeforeunload = ()=> {
			this.flush_tile_queue();
		}
	},
	ontileload: function(e) {
		//should only check tiles
		if((e.source.type=="vector" || e.source.type=="raster") && e.coord && e.coord.canonical) {
			if(e.tile.resourceTiming) {
				var loadTime = e.tile.resourceTiming[0].duration;
			} else {
				var loadTime = 100; //turned off, assume uncached
			}
			if(loadTime>40) {
				var stylesheet = e.style.stylesheet.name;
				var provider = e.source.provider;
				var sourcekey = e.source.sourcekey;
				var coord = [e.coord.canonical.z,e.coord.canonical.x,e.coord.canonical.y];
				if(this.tiles_loaded == undefined) this.tiles_loaded = [];
				var logged = false; 
				for(var i in this.tiles_loaded) {
					if(this.tiles_loaded[i].p==provider && this.tiles_loaded[i].s==sourcekey) {
						this.tiles_loaded[i].c++; logged = true;
					}
				}
				if(!logged) this.tiles_loaded.push({p:provider,s:sourcekey,c:1});
				this.tiles_queued++;
			} else {
				//cached tile!
				//console.log(e.coord.key,"from cache",e.tile.resourceTiming[0].name);
			}
		}
	},
	onlayerchangestart: function(newbaselayer,lc,oldbaselayer) {
		$("#loadingMap").show();
		$(".effectCaption").css("pointer-events","none");
		$("#theSettings button").each((i,e)=>{$(e).prop("disabled",true)});
		$("#map canvas").css("filter","blur(2px) saturate(0.8)");
		$(".maplibregl-marker").css("filter","blur(2px) saturate(0.8)");
	},
	onlayerchangedone: function(newbaselayer,lc,oldbaselayer) {
		$("#wordmark").remove();
		if(newbaselayer.wordmark) {
			$(".maplibregl-ctrl-bottom-left").append('<div class="maplibregl-ctrl" id="wordmark">'+newbaselayer.wordmark+'</div>');
		}	
		/* if satellite, check if we should enable HD */
		if(newbaselayer.name=="Satellite") {
			if(this.mapUI.options.hd) {
				this.mapUI.map._map.setLayoutProperty("satellite_hd","visibility","visible");
			} else {
				this.mapUI.map._map.setLayoutProperty("satellite","visibility","visible");
			}
		}
		//checks if labels should be displayed
		if(typeof mGL.options.showLabels!="undefined" && mGL.options.showLabels==false) {
			this.mapUI.map._map.style.stylesheet.layers.forEach((layer)=>{
					if (layer.type === 'symbol') {
						this.mapUI.map._map.setLayoutProperty(layer.id,"visibility", "none");
					}
			});
		}
		$("#loadingMap").hide();
		$("#map canvas").css("filter","");
		$(".maplibregl-marker").css("filter","");
		$(".effectCaption").css("pointer-events","auto");
		$("#theSettings button").each((i,e)=>{$(e).prop("disabled",false)});
	}

}
