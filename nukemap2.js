//servers
var site = "https://nuclearsecrecy.com/nukemap/"; //main url for NUKEMAP -- used for permalink and reset
var server = dynamicAssets; //server-side processing for nukemap

/* 
 TO DO:

 EVENTUALLY:
 - migrate locator.php db to rds (may still be a good idea -- still the slowest thing)
 - make layercontrol work better on mobile. idea: make a mobile-only layer that pops up above
		the LC and triggers the expand on click, which also makes it disappear?

 */


//globals to hold det info
var dets = [];
var det_index = 0;
var legends = []; 

//global for probe marker
var sample_marker;

// this is used for casualties running on permalinks -- waits until last det is added
var casualties_delayed = false;

//holds objects loaded from presets.js
var presets = {};

//if this is set to true (with console) it will skip all constraints on yield
var skipyieldcheck = false;

//this is a place for load_map to call itself if it finds it is calling itself
//prior to the map scripts being added.
var on_map_scripts_ready = undefined;

//default detonation settings
var default_det = {
	airburst: true,
	hob_ft: 200,
	hob_opt: 1,
	hob_opt_psi: 5,
	fireball: true,
	psi: ["20","5"],
	rem: ["500"],
	therm: ["_3rd-100"],
	crater: false,
	casualties: false,
	humanitarian: false,	
	fallout: false,
	fallout_wind: 15,
	ff: 100,
	fallout_angle: 225,
	fallout_rad_doses: ["1","10","100","1000"],
	erw: false,
	linked: false,
	cep: false,
	cep_ft: 0,
	cloud: false,
};

//??
var det_min = 0;

//global objects
var map; 
var marker;

//??
var circle_stroke = 0;

/* Changes size of marker */
var marker_scale = 1;
if(isMobile()) marker_scale = 2; //seems to make a little easier to see

//geocoder server object
var geocoder; 

//circle radii holder
var c_radii = [];

//shape created on highlight
var highlightobj; 
var highlightblinker;

//not used in this file but maybe in others
var debug = DEBUG;

//user location info
var user_country;
var user_location;
var user_location_set = false;

//path to this base url
var basepath = window.location.protocol+"//"+location.hostname+window.location.pathname;

//debug parameter
var admin = 0;

//not sure this is needed
var pi = Math.PI;

var waitingforlink = false; 

//This is apparently needed to make the iPad click jQuery events work
var ua = navigator.userAgent, click_event = (ua.match(/iPad/i)) ? "touchstart" : "click";

//can be toggled by embedding
var hide_legend_hr;

//runs when the window is loaded
function start() {
	if(DEBUG) console.log("start");
	if(EMBEDDED) { //keep this invisible until loaded for embedded
		$("#theSettings").css("display","none");
		$("#theMap").css("right","0px");
	}

	/* //this seems a little dangerous to try and do to keep things up to date... 
	$.ajax({
	  dataType: "json",
	  url: dynamicAssets+"ver.php",
	  data: { ver: ver },
	  success: function(data) {
			if(data.status=="OLD") {
				console.log("ver OLD");
				//window.location.reload(true);
			} else if(data.status=="OLD2") {
				console.log("version is out of date but refreshing didn't help");
			} else {
				console.log("ver OK");
			}
		}
	})*/

	//try to locate via IP, so we can set the initial starting point
	get_location(function(success,data) {
		if(success) {
			user_location = data;
			user_location.closest = closest_city(data.results[0].lat,data.results[0].lon,data.results[0].country_code);
			user_country = user_location.closest.country;
			if(DEBUG) console.log("locator_success",data,user_location,user_country);
		} else {
			if(DEBUG) console.warn("locator_fail",data);
		}
		if(!user_location_set) { 
			user_location_set = true;
			load_map();
		}		
	});
	//if it hasn't set the starting point after a few seconds, load it anyway
	window.setTimeout(function() { if(!user_location_set) { user_location_set=true; if(DEBUG) console.log("locator timeout"); load_map();}},3000);

	loadPresets();

	//get the map library
	var mapUIoptions = {
		hd: isHighDensity(),
		library: ()=>{
			if(forceMode==1) return "raster-leaflet";
			if(forceMode==2) return "vector-maplibre";
			if(forceMode==3) return "raster-leaflet-protomaps";
			if(webGLsupported()) {
				return "vector-maplibre";
			} else {
				return "raster-leaflet-protomaps";
			}
		},
		dynamicAssets: dynamicAssets,
		imageAssets: imageAssets,
		staticAssets: staticAssets,
		onloadstart: (total)=> {
			$("#loadingCap").html("Loading necessary files...");
			$("#loadingBarHolder").show();	
		},
		onloadprogress: (loaded,total,file) => {
			$("#loadingBar").css("width",Math.round(loaded/total*100)+"%");
			$("#loadingBarHolder").attr("title","Loaded "+loaded+" out of "+ total + " files ("+Math.round(loaded/total*100)+"%"+")");
		},
		onloaddone: (loaded,total) => {
			$("#loadingBarHolder").css("display","none");
		},
	}
	//import NUKEMAP-specific map mode settings
	if(mapUI_settings[mapUIoptions.library()]) mapUIoptions = {...mapUIoptions,...mapUI_settings[mapUIoptions.library()]}

	if(DEBUG) console.log("Loading library '"+mapUIoptions.library()+"'"+(forceMode?(" (forceMode="+forceMode+")"):""));

	//create mapUI library instance
	MAPUI = new mapUI(mapUIoptions,()=>{
		MAPUI.ready = true;
		if(DEBUG) console.log("mapUI ready");
		if(typeof on_map_scripts_ready == "function") on_map_scripts_ready();
	})

	//load millions used line asynchronously -- will update local cache daily
	let today = new Date();
	$('<link>').appendTo('head')
	.attr({
		type: 'text/css', 
		rel: 'stylesheet',
		href: dynamicAssets+'millions.css?d='+(''+today.getFullYear()+today.getMonth()+today.getDate())
	});
	
	$('#version').title = "NUKEMAP version "+ver;
	$('#version').html(Math.round(ver,2));
	$('#version_faq').delay(1000).fadeIn('slow'); 
	
	//minimize interface
	$('#minimize_interface').bind(click_event, function () {
		$('#topFrame').hide();
		$('#bottomFrame').hide();
		$('#theSettings').addClass('settingsMin');
		$('#theMap').addClass('mapMax');
		$('#hiddenFrame').show();
		map_logo(0);
	})

	//panemover for mobile
	$("#panemover").bind(click_event, function () {
		if($("#panemover").hasClass("up")) {
			panemover(false);
		} else {
			panemover(true);
		}
	})
	
	//adds the NUKEMAP wordmark to the map if it is made full-screen
	//these events are only detected some of the time -- not a huge deal
	$(document).bind('webkitfullscreenchange mozfullscreenchange fullscreenchange', function() {
		var isFullScreen = document.fullScreen ||
			document.mozFullScreen ||
			document.webkitIsFullScreen;
		if (isFullScreen) {
			map_logo(false);
		} else {
			map_logo(true);
		}
	});
	
	//if they click the logo on the map, restores the interface
	$(document).on(click_event,"#logo",function () {
		$('#restore_interface').click();
	})
	
	//clickable abbreviations
	$(".def").on(click_event,function() {
		malert($(this).attr("title"));
	})
	
	//restores the interface if in maximized mode
	$('#restore_interface').bind(click_event, function () {
		$('#theMap').removeClass('mapMax');
		$('#theSettings').removeClass('settingsMin');
		$('#topFrame').show();
		$('#bottomFrame').show();
		$('#hiddenFrame').hide();
		map_logo(1);
	})
	
	//make the fallout go away on unclick -- otherwise it can be annoying and persistent
	$('.fallout_check').bind(click_event, function () {
		if($(this).prop("checked")==false) {
			if(typeof fallout_contours[det_index] !="undefined") clear_fallout();
			stop_fallout();
			if(dets[det_index]) dets[det_index].fallout = false;
			update_permalink();
		}
	})
	
	//removes casualties if they uncheck the box
	$('#casualties_check').bind(click_event, function () {
		if($(this).prop("checked")==false) {
			$("#theLegendCasualties").html("");
		}
	})
	
	//fallout gets updated dynamically if you change its settings
	$("#fallout_angle").on('change',function() {
		update_fallout();
	})
	$("#fallout_wind").on('change', function() {
		update_fallout();
	})
	$("#fallout_fission").on('change', function() {
		update_fallout();
	})
	
	$(document).on("mouseenter",".effectCaption",function() {
		if($(this).attr("radius")&&$(this).attr("index")) {
			$(".effectCaption").toggleClass("highlight",false);
			$(this).toggleClass("highlight",true);
			if(highlightobj) highlightobj = highlightobj.remove();
			if(highlightblinker) clearInterval(highlightblinker);
			highlightobj = newCircle({
				map:MAPUI.map,
				radius: parseFloat($(this).attr("radius"))*km2m,
				fill: false,
				fillOpacity: 0,
				stroke: true,
				color: "#ffffff",
				opacity: 1,
				weight: 4,
				zindex: (det_index+1)*100,
			},undefined,{lat:latval(dets[parseInt($(this).attr("index"))].pos), lon:lngval(dets[parseInt($(this).attr("index"))].pos)});		
		} else if($(this).attr("fallout_contour")&&$(this).attr("index")) {
			var i = $(this).attr("fallout_contour");
			if(typeof fallout_contours[det_index][i] != "undefined") {
				//should develop a more agnostic way to get and pass polygon coordinates...
				var coords = fallout_contours[det_index][i].getLatLons();
				if(highlightobj) highlightobj = highlightobj.remove();
				if(highlightblinker) clearInterval(highlightblinker);
				highlightobj = MAPUI.polygon({
					latLons: coords,
					stroke: true,
					map: MAPUI.map,
					color: "#ffffff",
					opacity: 1,
					visible: true,
					weight: 4,
					fill: false,
					fillOpacity: 0,
					zindex: (det_index+1)*100,
					pane: "circlePane",
					beforeLayer: "falloutLayer",
				})
			}
		}
		if(highlightobj) {
			highlightblinker = setInterval(function() {
				if(highlightobj) {
					var stroke = highlightobj.getProperty("stroke");
					
					highlightobj.setOptions({stroke: stroke?false:true});
				}
				}
			,500);
			$(this).toggleClass("highlight",true);
		}
	})
	//removes the highlight circle
	$(document).on('mouseleave','.effectCaption',function() { 
		if(highlightobj) highlightobj = highlightobj.remove();
		if(highlightblinker) clearInterval(highlightblinker);
		$(".effectCaption").toggleClass("highlight",false);
	});

}

/* moves the mobile pane */
function panemover(moveUp) {
	if(moveUp) {
		$("#panemover").addClass("up");
		if($("#panemoverholder").css("display")=="block") {
			$("#theSettings").animate({
				top: "9vh"
			},800,()=> {
				$("#theSettings").addClass("movedup");
				$("#theSettings").css("top","");
			});
		} 
	} else {
		$("#panemover").removeClass("up");
		if($("#panemoverholder").css("display")=="block") {
			$("#theSettings").animate({
				top: "70vh"
			},800,() => {
				$("#theSettings").removeClass("movedup");
				$("#theSettings").css("top","");
			})
		} else {
			$("#theSettings").removeClass("movedup");
			$("#theSettings").css("top","");
		}
	}
}

//begins the loading of the map
function load_map(o = false) {
	if(!MAPUI.ready) {
		if(DEBUG) console.log("load_map called before mapUI available -- waiting");
		$("#loadCap").html("Waiting for map...");
		on_map_scripts_ready = function() { load_map(o); }
		return false;
	}

	//load data from permalinks if possible
	var u = getUrlVars();
	if(DEBUG) console.log("urlvars",u);
	if(EMBEDDED) {
		$("#theSettings").css("display",""); 
		$("#theMap").css("right",""); 
	}
	if(u!==false) {
		if(DEBUG) console.log("Loading permalinks...",u);
		loadingPermaDiv(true);
		if(u["admin"]) admin = u["admin"];
		if(u["lite"]) applyLite(u["lite"]);
		if(u["unlimited"]) unlimited = u["unlimited"];
		if(u["load"]) {
			loadExternalDets(u["load"]);
			return;
		}
		if(u["t"]) {
			hash_request(u["t"]);
		} else {
			permalinks_to_det(u);
			if(dets.length) {
				init(dets[dets.length-1].pos,parseInt(u["zm"]),function() {
					if(DEBUG) console.log("Loading dets from permalink...");
					for(var i = 0; i<dets.length;i++) {
						detonate(true,dets[i],i,true);
						if(i<dets.length-1) {
							detach(true);
						}
					}
					$('#theKt').val(dets[det_index].kt);
					if(casualties_delayed) { //only run casualties after last det has been added
						casualties_delayed = false;
						if(DEBUG) console.log("get_casualties_multi",dets);
						get_casualties_multi(dets,"theLegendCasualties");
					}
					loadingPermaDiv(false);
				})
			} else {
				init();
				loadingPermaDiv(false);		
			}
		}
	} else { //otherwise just load
		init();
	}
}


//function that triggers the 'detonation'.
//should be refactored quite a bit. a mess.
function detonate(override_autozoom,params,d_index,delay_casualties = false) {
	if(DEBUG) console.log("detonate",params,d_index);
	var fireball = false;
	var crater = false;
	var casualties = false;
	var humanitarian = false;
	var humanitarian_show = false;
	var fallout = false;
	var collapser = false;
	var cep = false;
	var cep_ft = 0;
	var erw = false;
	var cloud = false;

	var c = [];
	var psi = [];
	var rem = [];
	var therm = [];

	var errs = [];

	if(!params) {

		ktInput = $("#theKt").val();

		if(ktInput=='') {
			if($("#preset").val()>0) {
				ktInput = $("#preset").val();
				$("#theKt").val(ktInput);
			}
		}

		if(ktInput=='') {
			$("#detonate_error").html("Please specify a <b>yield</b> above.")
			$("#detonate_error").slideDown(100).delay(2000).slideUp(100);
			$("#yield_div").fadeIn(100).fadeOut(100).fadeIn(100).fadeOut(100).fadeIn(100);
			return false;
		} 
	
		kt = parseFloat(ktInput);

		if(kt<=0) {
			$("#detonate_error").html("Please specify a <b>yield</b> above.")
			$("#detonate_error").slideDown(100).delay(2000).slideUp(100);
			$("#yield_div").fadeIn(100).fadeOut(100).fadeIn(100).fadeOut(100).fadeIn(100);
			return false;
		}
		$("#detonate_error").hide();	
		
		/* To avoid some numerical silliness. */
		if(!skipyieldcheck) {
			if(kt<0.001) {
				kt = 0.001;
			} if(kt<1) {
				kt = Math.round(kt,3);
			} else if(kt<10) {
				kt = Math.round(kt,1);
			} else { 
				kt = Math.round(kt,0);
			}
			$("#theKt").val(kt);

			if(kt>100000) {
				malert("The NUKEMAP cannot accurately model yields greater than 100,000 kilotons (100 megatons).");
				return false;
			}
		}

		pos = marker.getLatLon();

		panemover(false);

		var opt = document.forms["options"];

		var hob_ft = 0;
		if(opt["hob"][0].checked) {
			var airburst = true;
			if(opt["hob_option"][1].checked) {
				var hob_opt = 1;
				var hob_opt_psi = parseFloat(opt["hob_psi"].value);
				if(hob_opt_psi<1||hob_opt_psi>10000) {
					errs.push("Range of psi for choosing an optimum height is 1 to 10,000.");
					var hob_opt = 0;
				} else {
					hob_ft = Math.round(bc.opt_height_for_psi(kt,parseFloat(hob_opt_psi)));
				}
			} else if(opt["hob_option"][2].checked) {
				var hob_opt = 2;
				var hob_opt_psi = 5; //default
				switch(parseInt(opt["hob_h_u"].value)) {
					case 1: //m
						hob_ft = Math.round(parseFloat(opt["hob_h"].value)*m2ft);
					break;
					case 2: //mi
						hob_ft = Math.round(parseFloat(opt["hob_h"].value)*mi2ft);
					break;
					case 3: //km
						hob_ft = Math.round(parseFloat(opt["hob_h"].value)*km2ft);				
					break;
					default: //ft
						hob_ft = Math.round(parseFloat(opt["hob_h"].value));
					break;
				}
			} else {
				var hob_opt = 0;
			}
		} else {
			var airburst = false;
		}

		for(var i=0; i<opt["psi"].length;i++) {
			if(opt["psi"][i].checked) {
				if(opt["psi"][i].value>0) {
					psi.push(opt["psi"][i].value);
				} else if(opt["psi"][i].value<0) {
					var other = parseFloat(opt["psi_other_"+(parseInt(opt["psi"][i].value)*-1)].value);
					if((other>=1)&&(other<=10000)) {
						psi.push(parseFloat(other));
					} else {
						errs.push("Range for overpressure is 1-10,000 psi; entry of "+other+" skipped.");
					}
				}
			}
		}
		
		for(var i=0; i<opt["rem"].length;i++) {
			if(opt["rem"][i].checked) {
				if(opt["rem"][i].value>0) {
					rem.push(opt["rem"][i].value);
				} else if(opt["rem"][i].value < 0){
					var other = parseFloat(opt["rem_other_"+(parseInt(opt["rem"][i].value)*-1)].value);
					if(other>=1&&other<=Math.pow(10,8)) {
						rem.push(other);
					} else {
						errs.push("Range for initial nuclear radiation is 1-10^8 rem; entry of "+other+" skipped.");
					}
				}
			}
		}

		for(var i=0; i<opt["therm"].length;i++) {
			if(opt["therm"][i].checked) {
				if(opt["therm"][i].value>0||opt["therm"][i].value[0]=="_") {
					therm.push(opt["therm"][i].value);
				} else if (opt["therm"][i].value<0) {
					var other = parseFloat(opt["therm_other_"+(parseInt(opt["therm"][i].value)*-1)].value);
					if(other>0) {
						therm.push(other);
					}
				}
			}
		}
	
		if(opt["other"][0].checked) casualties = true;
		if(opt["other"][1].checked) fireball = true;
		if(opt["other"][2].checked) crater = true;
		if(opt["other"][3].checked) humanitarian = true;
		if(opt["other"][4].checked) humanitarian_show = true;
		if(opt["other"][5].checked) fallout = true;
		if(opt["other"][6].checked) cep = true;
		if(opt["other"][7].checked) cloud = true;	

		var fallout_wind = parseInt(document.getElementById("fallout_wind").value);
		if(fallout_wind<0) { //bind the wind speed to respectable options
			fallout_wind = 0;
			document.getElementById("fallout_wind").value = fallout_wind;
		} else if(fallout_wind>50) { 
			fallout_wind = 50;
			document.getElementById("fallout_wind").value = fallout_wind;
		}
	
		var ff = parseInt(document.getElementById("fallout_fission").value);
		if(ff<=0) {
			ff = 1;
			document.getElementById("fallout_fission").value = ff;
		} else if (ff>100 && !skipyieldcheck) {
			ff = 100;
			document.getElementById("fallout_fission").value = ff;
		}

		if(document.getElementById("fallout_angle").value) {
			var fallout_angle = document.getElementById("fallout_angle").value;
		} else if(windsock_marker) {
			markerpos = marker.getLatLon();
			windsockpos = windsock_marker.getLatLon();
			var fallout_angle = fallout_bearing(markerpos,windsockpos);
		} else {
				var fallout_angle = null;
		}

		if(opt["collapser"]!=undefined) {
			if(opt["collapser"].checked) collapser = true;
		}

		dets[det_index] = {
			kt: kt,
			pos: pos,
			airburst: airburst,
			hob_opt: hob_opt,
			hob_psi: hob_opt_psi,
			hob_ft: hob_ft,
			fireball: fireball,
			crater: crater,
			casualties: casualties,
			humanitarian: humanitarian,
			fallout: fallout,
			fallout_wind: fallout_wind,
			ff: ff,
			fallout_angle: fallout_angle,
			erw: erw,
			psi: psi,
			rem: rem,
			therm: therm,
			cep: cep,
			cep_ft: cep_ft,
			cloud: cloud
		};

	} else {
		if(DEBUG) console.log(params);
		var opt = document.forms["options"];
		if(!params.pos) return false;
		det_index = d_index;
		if(params.kt) {
			kt = params.kt; 
			$("#theKt").val(kt);
		}
		if(params.pos) { 
			pos = params.pos;
			marker.setLatLon(pos);
		}
		if(params.airburst!=undefined)	{
			airburst = params.airburst;
			if(airburst) { 
				opt["hob"][0].checked = true;
			} else {
				opt["hob"][1].checked = true;
			}
		}

		if(params.hob_opt!=undefined) {
			hob_opt = params.hob_opt;
			hob_opt_psi = params.hob_psi;
			if(typeof params.hob !="undefined") {
				params.hob_ft = params.hob; //some old permalinks have this instead, it looks like
			}
			hob_ft = params.hob_ft;
			opt["hob_option"][hob_opt].checked = true;
			if(hob_opt_psi) opt["hob_psi"].value = hob_opt_psi;
			if(hob_ft||params.hob_ft!=undefined) opt["hob_h"].value = hob_ft;
			if(!hob_ft&&hob_opt_psi&&hob_opt==1) {
				hob_ft = Math.round(bc.opt_height_for_psi(kt,parseFloat(hob_opt_psi)));
			}
		}

		if(params.fireball!=undefined) { 
			fireball = params.fireball;
			opt["other"][1].checked = fireball;
		}
		
		if(params.crater) { 
			crater = params.crater;
			opt["other"][2].checked = crater;
		}
		if(params.casualties) { 
			casualties = params.casualties;
			opt["other"][0].checked = casualties;
		}
		if(params.humanitarian) { 
			humanitarian = params.humanitarian;
			opt["other"][3].checked = humanitarian;
		}
		if(params.humanitarian_show) { 
			humanitarian = params.humanitarian_show;
			opt["other"][4].checked = humanitarian_show;
		}
		if(params.fallout) { 
			fallout = params.fallout;
			opt["other"][5].checked = fallout;
			document.getElementById("fallout_check_2").checked = opt["other"][5].checked;
		}
		if(params.cloud) {
			cloud = params.cloud;
			opt["other"][7].checked = cloud;
		}
		
		if(params.fallout_wind!=undefined) {
			fallout_wind = params.fallout_wind;
			document.getElementById("fallout_wind").value = fallout_wind;
		}

		if(params.ff) {
			ff = params.ff;
			document.getElementById("fallout_fission").value = ff;
		}	

		if(params.fallout_angle!==undefined) {
			fallout_angle = params.fallout_angle;
			document.getElementById("fallout_angle").value = fallout_angle;
		}
		
		if(params.fallout_rad_doses) {
			rad_doses = params.fallout_rad_doses;
		}
		
		if(params.cep) {
			cep = params.cep;
			opt["other"][6].checked = cep;
		}
		
		if(params.cep_ft) {
			cep_ft = params.cep_ft;
			opt["cep"].value = cep_ft;
		}
		
		if(params.erw) { 
			erw = params.erw;
			//opt["other"][7].checked = erw;
		}
		
		if(params.psi&&!isEmptyArray(params.psi)) { 
			psi = params.psi;
			document.getElementById("addrow_psi").innerHTML="";
			opt["psi_other_1"].value = "";
			document.getElementById("psi_other_check_1").checked = false;
			
			for(var i=0; i<opt["psi"].length;i++) {
				if(inArray(opt["psi"][i].value,psi)) {
					opt["psi"][i].checked = true;
				} else {
					opt["psi"][i].checked = false;
				}
			}
			for(var i=0;i<psi.length;i++) {
				switch(psi[i]){
					case "3000": case "200": case "20": case "5": case "1":
						//do nothing, these are already in the controls
					break;
					default:
						var p = 1;
						while(opt["psi_other_"+p].value) {
							addrow('psi');
							p++;
						}
						opt["psi_other_"+p].value = psi[i];
						document.getElementById("psi_other_check_"+p).checked = true;
					break;
				}
			}
		} else {
			for(var i=0; i<opt["psi"].length;i++) {
				opt["psi"][i].checked = false;
			}		
		}
		if(params.rem&&!isEmptyArray(params.rem)) { 

			rem = params.rem;
			document.getElementById("addrow_rem").innerHTML="";
			opt["rem_other_1"].value = "";
			document.getElementById("rem_other_check_1").checked = false;
			
			for(var i=0; i<opt["rem"].length;i++) {
				if(inArray(opt["rem"][i].value,rem)) {
					opt["rem"][i].checked = true;
				} else {
					opt["rem"][i].checked = false;
				}
			}
			for(var i=0;i<rem.length;i++) {
				switch(rem[i]){
					case "100": case "500": case "600": case "1000": case "5000":
						//do nothing, these are already in the controls
					break;
					default:
						var p = 1;
						while(opt["rem_other_"+p].value) {
							addrow('rem');
							p++;
						}
						opt["rem_other_"+p].value = rem[i];
						document.getElementById("rem_other_check_"+p).checked = true;
					break;
				}
			}
		} else {
			for(var i=0; i<opt["rem"].length;i++) {
				opt["rem"][i].checked = false;
			}		
		}
		if(params.therm&&!isEmptyArray(params.therm)) { 
			therm = params.therm;
			document.getElementById("addrow_therm").innerHTML="";
			opt["therm_other_1"].value = "";
			document.getElementById("therm_other_check_1").checked = false;
			
			for(var i=0; i<opt["therm"].length;i++) {
				if(inArray(opt["therm"][i].value,therm)) {
					opt["therm"][i].checked = true;
				} else {
					opt["therm"][i].checked = false;
				}
			}
			for(var i=0;i<therm.length;i++) {
				switch(therm[i]){
					case "_3rd-100": case "_3rd-50": case "_2nd-50": case "_1st-50": case "_noharm-100": case "35":
						//do nothing, these are already in the controls
					break;
					default:
						var p = 1;
						while(opt["therm_other_"+p].value) {
							addrow('therm');
							p++;
						}
						opt["therm_other_"+p].value = therm[i];
						document.getElementById("therm_other_check_"+p).checked = true;
					break;
				}
			}
		} else {
			for(var i=0; i<opt["therm"].length;i++) {
				opt["therm"][i].checked = false;
			}		
		}
	}
	if(typeof params !=="undefined") {
		if(params.nd==1) return;
	}

	pos_lat = latval(pos);
	pos_lng = lngval(pos);
	
	/*if(humanitarian) {
		get_places(pos_lat,pos_lng, bc.distance_from_scaled_range(bc.maximum_overpressure_range(10,airburst),kt)*mi2m,humanitarian_show,"theLegendPlaces"); 
	}*/
	
	if(casualties) {
		if(delay_casualties) {
			casualties_delayed = true;
		} else {
			if(DEBUG) console.log("get_casualties_multi",dets);
			get_casualties_multi(dets,"theLegendCasualties");
		}
	} else {
		$("#theLegendCasualties").html("");
	}
	
	if(fallout) {
		if(hob_ft&&airburst) {
			do_fallout(kt,fallout_wind,ff,fallout_angle,"theLegendFallout",airburst,hob_ft);
		} else {
			do_fallout(kt,fallout_wind,ff,fallout_angle,"theLegendFallout",airburst);		
		}
	}

	if(cep==true) {
		switch(parseInt(opt["cep_unit"].value)) {
			case 1: //m
				cep_ft = Math.round(parseFloat(opt["cep"].value)*m2ft);
			break;
			case 2: //mi
				cep_ft = Math.round(parseFloat(opt["cep"].value)*mi2ft);
			break;
			case 3: //km
				cep_ft = Math.round(parseFloat(opt["cep"].value)*km2ft);				
			break;
			default: //ft
				cep_ft = Math.round(parseFloat(opt["cep"].value));
			break;
		}
		if(cep_ft>0) {
			c.push([cep_ft*ft2mi,"cep",50]);
			c.push([cep_ft*2*ft2mi,"cep",43]);
			c.push([cep_ft*3*ft2mi,"cep",7]);			
		} else {
			errs.push("The Circular Error Probable given is an invalid value. CEP must be greater than zero to display.");	
		}
	}

	if(c_radii[det_index]) {
		for(var i=0;i<c_radii[det_index].length;i++) {
			c_radii[det_index][i] = c_radii[det_index][i].remove();
		}
		c_radii[det_index] = [];
	}

	for(var i=0;i<psi.length;i++) {
		if(airburst==true) {
			if(!hob_opt) {
				var t = bc.psi_distance(kt,psi[i],airburst);
			} else {
				var t = bc.range_from_psi_hob(kt,psi[i],hob_ft)*ft2mi;
			}
		} else {
			var t = bc.range_from_psi_hob(kt,psi[i],0)*ft2mi;
			//var t = bc.psi_distance(kt,psi[i],airburst);
		}
		if(t>0) {
			c.push([t,"psi",psi[i]]);	
		} else {
			var err = "The blast pressure equation for "+unit(psi[i],"psi")+" failed to give a result for the given yield and height settings.";
			if(hob_ft&&airburst&&hob_opt) {
				err+=" The maximum detonation height for this effect to be felt on the ground is "+unit(bc.max_height_for_psi(kt,psi[i])*ft2km,"km")+".";
			}
			errs.push(err);
		}
	}

	for(var i=0;i<rem.length;i++) {
		if(erw) {
			var r_kt = kt*10;
		} else {
			var r_kt = kt;
		}
		var t = bc.initial_nuclear_radiation_distance(r_kt,rem[i]);
		var t1 = t;
		if(hob_ft&&airburst) {
			t = bc.ground_range_from_slant_range(t,hob_ft*ft2mi);
		}
		if(t>0) {
			c.push([t,"rem",rem[i]]);
		} else {
			var err = "The initial nuclear radiation equation for "+unit(rem[i],"rem")+" failed to give a result for the given yield and height settings.";
			if(hob_ft&&airburst) {
				if(hob_ft*ft2mi > t1) {
					err+=" The maximum detonation height for this effect to be felt on the ground is "+unit(t1*mi2km,"km")+".";
				}
			}
			errs.push(err);
		}
	}

	for(var i=0;i<therm.length;i++) {		
		var t = bc.thermal_distance(kt,therm[i],airburst);
		var t1 = t;
		if(hob_ft&&airburst) {
			t = bc.ground_range_from_slant_range(t,hob_ft*ft2mi);
		}
		if(t>0) {
			c.push([t,"therm",therm[i]]);
		} else {
			if(therm[i][0]=="_") {
				switch(therm[i]) {
				case "_3rd-100":
					var t_text = "3rd degree burns";
				break;
				case "_3rd-50":
					var t_text = "3rd degree burns (50%)";
				break;
				case "_2nd-50":
					var t_text = "2nd degree burns (50%)";
				break;
				case "_1st-50":
					var t_text = "1st degree burns (50%)";
				break;
				case "_noharm-100":
					var t_text = "no harm";
				break;	
				}
				var err = "Thermal radiation ("+t_text+") equation failed to give a result for the given yield and height."
				if(hob_ft&&airburst) {
					if(hob_ft*ft2mi > t1) {
						err+=" The maximum detonation height for this effect to be felt on the ground is "+unit(t1*mi2km,"km")+".";
					}
				}
				errs.push(err);				
			} else {
				var err = "Thermal radiation ("+unit(therm[i],"cal")+") equation failed to give a result for the given yield and height.";
				if(hob_ft&&airburst) {
					if(hob_ft*ft2mi > t1) {
						err+=" The maximum detonation height for this effect to be felt on the ground is "+unit(t1*mi2km,"km")+".";
					}
				}
				errs.push(err);							
			}
		}
	}
	
	if(fireball) {
		var t = bc.fireball_radius(kt,hob_ft);
		if(t>0) {
			c.push([t,"fireball",""]);
		} else {
			errs.push("The fireball size equation failed to give a result for the given yield.");
		}
	}

	var cr = bc.crater(kt,true);
	if(crater) {
		if((cr[0]>0)&&(cr[1]>0)) {
			c.push([cr[1],"crater",""]);
		} else {
			errs.push("The crater size equation failed to give a result for the given yield.");
		}
	}

	if(collapser) {
		if($('#hider-arrow').attr("expanded") == "1") {
			$('#hider-arrow').click();
		}
	}

	var legend ="";
	if(!hide_legend_hr) legend = "<hr>";
	legend+="<span id='effects-header'>";
	legend+="<b>Effect distances for a "+ ktOrMt(kt,false,true) + " "+(airburst?"airburst*":"surface burst")+"</b>: ";
	legend+="<span class='hider-arrow expanded' expanded='1' div='effects_captions' onclick='expand_div(this);'>&nbsp;</span>"
	legend+="</span>";
	legend+="<div class='collapsed-content' id='effects_captions'>";
	legend+="<div class='effectsCaptions'>";

 	c.sort(function(a,b){return b[0]-a[0]});

	legend1 = ""; //this is a separate variable because we are going to be adding to it from the bottom up

	var effectCaptions = [];

	//cloud caption loads first, to show last
	if(cloud) {
		//all of these are in FEET
		var cloud_final_horizontal_semiaxis = bc.cloud_final_horizontal_semiaxis(kt); 
		var cloud_final_height = bc.cloud_top(kt);
		var cloud_final_vertical_semiaxis = (cloud_final_height-bc.cloud_bottom(kt))/2;

		var top_altitude = cloud_final_height*ft2km;
		var head_diameter = cloud_final_horizontal_semiaxis*2*ft2km;
		var head_height = cloud_final_vertical_semiaxis*2*ft2km;

		effectCaptions.push({
			title: "Mushroom cloud head height",
			radius: head_height,
			show_area: false,
			no_highlight: true,
			legendkey: "<span class='legendkey_symbol'>&varr;</span>",
			clear: true
		})

		effectCaptions.push({
			title: "Mushroom cloud head radius",
			radius: head_diameter/2,
			id: "cloud_diameter",
			legendkey: "<span class='legendkey_symbol'>&harr;</span>",
		})

		effectCaptions.push({
			title: "Mushroom cloud altitude",
			topinsert: "<div><a class='effectImage' href='"+imageAssets+"clouddiagram.png' title='Click to enlarge this image' target='_blank' onclick='show_image(this); return false;' ><img src='"+imageAssets+"clouddiagram.png'></a></div>",
			radius: top_altitude,
			show_area: false,
			no_highlight: true,
			legendkey: "<span class='legendkey_symbol'>&uarr;</span>",
		})
	}

	c_radii[det_index] = [];

	var circs=0;
	for(rec in c) {
		switch (c[rec][1]) {		
			case "therm":
				switch(c[rec][2]) {
					case "_3rd-100":
						var t_text = "3rd degree burns";
						var t_extra = "100% probability for 3rd degree burns at this yield is "+unit(bc.thermal_radiation_param_q(kt,c[rec][2]),"cal")+".";
						var caption = "Third degree burns extend throughout the layers of skin, and are often painless because they destroy the pain nerves. They can cause severe scarring or disablement, and can require amputation.";
					break;
					case "_3rd-50":
						var t_text = "3rd degree burns (50%)";
						var t_extra = "50% probability for 3rd degree burns at this yield is "+unit(bc.thermal_radiation_param_q(kt,c[rec][2]),"cal")+".";				
						var caption = "Third degree burns extend throughout the layers of skin, and are often painless because they destroy the pain nerves. They can cause severe scarring or disablement, and can require amputation.";
					break;
					case "_2nd-50":
						var t_text = "2nd degree burns (50%)";
						var t_extra = "50% probability for 2nd degree burns at this yield is "+unit(bc.thermal_radiation_param_q(kt,c[rec][2]),"cal")+".";				
						var caption = "Second degree burns are deeper burns to several layers of the skin. They are very painful and require several weeks to heal. Extreme second degree burns can produce scarring or require grafting.";
					break;
					case "_1st-50":
						var t_text = "1st degree burns (50%)";
						var t_extra = "50% probability for 1st degree burns at this yield is "+unit(bc.thermal_radiation_param_q(kt,c[rec][2]),"cal")+".";				
						var caption = "First degree burns are superficial burns to the outer layers of the skin. They are painful but heal in 5-10 days. They are more or less the same thing as a sunburn.";
					break;
					case "_noharm-100":
						var t_text = "no harm";
						var t_extra = "100% probability of no significant thermal damage at this yield is "+unit(bc.thermal_radiation_param_q(kt,c[rec][2]),"cal")+".";				
						var caption = "The distance at which anybody beyond would definitely suffer no damage from thermal radiation (heat).";
					break;	
					default:
						var t_text = "";
						var t_extra = "";
						var caption = "";
					break;	
				}
	
				var effectCircle = {
					map: MAPUI.map,
					radius: c[rec][0]*mi2m,
					fill: true,
					fillColor: "#FFA500",
					fillOpacity: .3,
					stroke: true,
					color: "#FFA500",
					opacity: 1,
					weight: 1,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Thermal radiation radius ("+(t_text?t_text:c[rec][2]+" cal/cm<sup>2</sup>)"),
				};
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);
				effectCaptions.push({
					title: "Thermal radiation radius ("+(t_text?t_text:unit(c[rec][2],"cal"))+")",
					caption: caption+(t_extra==""?"":" "+t_extra),
					radius: effectCircle.radius*m2km,
					fillColor: effectCircle.fillColor,
					strokeColor: effectCircle.strokeColor
				})

			break;

			case "psi":
				var p = parseInt(c[rec][2]);

				var effectCircle = {
					map: MAPUI.map,
					radius:  c[rec][0]*mi2m,
					fill: true,
					fillColor: "#"+colorStep(p-5,20,"808080","FF0000","800000","800000"),
					fillOpacity: p>=5?.3:lerp(.3,5,.2,1,p),
					stroke: true,
					color: "#"+colorStep(p-5,20,"808080","FF0000","800000","800000"),
					opacity: p>=5?1:lerp(1,5,.5,1,p),
					weight: p<5?1:2,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Air blast radius ("+addCommas(p)+" psi)",
				};
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);

				switch(true) {
					case (p == 10000):  
						var caption = "10,000 psi is approximately the pressure felt at 4 miles under the ocean. Not much can withstand this.";
					break;
					case (p == 7000):
						var caption = "7,000 psi is supposedly the maximum amount of pressure that super-hardened American missile silos can withstand.";
					break;
					case (p<10000&&p>1000):
						var caption = "Missile silos can be blast hardened to survive many thousand psi of pressure, but not much else can.";
					break;
					case (p == 200):
						var caption = "200 psi is approximately the pressure felt inside of a steam boiler on a locomotive. Extreme damage to all civilian structures, some damage to even &quot;hardened&quot; structures.";
					break;
					case (p == 20):
						var caption = "At 20 psi overpressure, heavily built concrete buildings are severely damaged or demolished; fatalities approach 100%. Often used as a benchmark for <b>heavy</b> damage in cities.";
					break;
					case (p < 20 && p > 5):
						var caption = "Between moderate and heavy damage in cities.";
					break;
					case (p == 5):
						var caption = "At 5 psi overpressure, most residential buildings collapse, injuries are universal, fatalities are widespread. The chances of a fire starting in commercial and residential damage are high, and buildings so damaged are at high risk of spreading fire. Often used as a benchmark for <b>moderate</b> damage in cities.";
					break;
					case (p < 5 && p > 1):
						var caption = "Between light and moderate damage in cities. Buildings damaged with between 2 and 5 psi of blast are considered a major risk for fire spread (because they are damaged but still standing).";
					break;
					case (p == 1):
						var caption = "At around 1 psi overpressure, glass windows can be expected to break. This can cause many injuries in a surrounding population who comes to a window after seeing the flash of a nuclear explosion (which travels faster than the pressure wave). Often used as a benchmark for <b>light</b> damage in cities.";
					break;
					default:
						var caption = "";
					break;				
				}
				if(airburst) {
					caption+=" Optimal height of burst to maximize this effect is "+unit(bc.opt_height_for_psi(kt,c[rec][2])*ft2km,"km",{prefer_smaller:true})+".";
				}

				var title = "";
				switch(p) {
					case 20: title ="Heavy blast damage radius ("+unit(20,"psi")+")"; break;
					case 5: title ="Moderate blast damage radius ("+unit(5,"psi")+")"; break;
					case 1: title ="Light blast damage radius ("+unit(1,"psi")+")"; break;
					default: title = "Air blast radius ("+unit(c[rec][2],"psi")+")";
				}

				effectCaptions.push({
					title: title,
					caption: caption,
					radius: effectCircle.radius*m2km,
					fillColor: effectCircle.fillColor,
					strokeColor: effectCircle.strokeColor
				})

			break;
			
			case "rem":
				var effectCircle = {
					map: MAPUI.map,
					radius:  c[rec][0]*mi2m,
					fill: true,
					fillColor: "#00FF00",
					fillOpacity: .3,
					stroke: true,
					color: "#00FF00",
					opacity: 1,
					weight: 1,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Radiation radius ("+(c[rec][2])+" rem)",
				};
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);

				//linear fit to NAPB-90 data, table B-2, which is just LNT. cancer risk.
				var c_risk =0.0303*(c[rec][2])-0.2065;
				if(c_risk<1) {
					c_risk = "less than 1%";
				} else if(c_risk>100) {
					c_risk = "100%";
				} else {
					c_risk = Math.round(c_risk)+"%";
				}

				//incapacitation and death info comes from Jorma K. Miettinen, "Enhanced Radiation Warfare," BAS 33, no. 7 (1977), 32-37.
				var caption = unit(c[rec][2],"rem")+" ionizing radiation dose; ";
				if(c[rec][2]>=17000) {
					caption+="fatal, incapacitating within five minutes, death within one day."; //no need to talk about survivors		
				} else if(c[rec][2]>=7000) {
					caption+="fatal, incapacitating within five minutes, death within one to two days."; //no need to talk about survivors		
				} else if (c[rec][2]>=1000) {
					caption+="fatal, incapacitating within five minutes with recovery period, death within four to six days."; //no need to talk about survivors		
				} else if (c[rec][2]>=1000) {
					caption+="fatal, in two weeks or less."; //no need to talk about survivors
				} else if(c[rec][2]>=500) {
					caption+="likely fatal, in about 1 month; "+c_risk+" of survivors will eventually die of cancer as a result of exposure.";
				} else if(c[rec][2]>=250) {
					caption+="sickness inducing, medical care would be required, some deaths in 30-60 days; "+c_risk+" of survivors will eventually die of cancer as a result of exposure.";
				} else if(c[rec][2]>=100) {
					caption+="sickness inducing, less than 5% chance of death in 60 days; "+c_risk+" of survivors will die of cancer as a result of exposure.";
				} else if(c[rec][2]>0) {
					caption+="no immediate symptoms; "+c_risk+" of survivors will die of cancer as a result of exposure.";
				}
				effectCaptions.push({
					title: "Radiation radius ("+unit(c[rec][2],"rem")+")",
					caption: caption,
					radius: effectCircle.radius*m2km,
					fillColor: effectCircle.fillColor,
					strokeColor: effectCircle.strokeColor
				})

			break;
			
			case "fireball":
				var effectCircle = {
					map: MAPUI.map,
					radius:  c[rec][0]*mi2m,
					fill: true,
					fillColor: "#FFA500",
					fillOpacity: airburst?.3:.5,
					stroke: true,
					color: "#FFFF00",
					opacity: airburst?.8:1,
					weight: airburst?1:2,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Fireball radius",
				}
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);

				var caption = "Maximum size of the nuclear fireball; relevance to damage on the ground depends on the height of detonation. If it touches the ground, the amount of radioactive fallout is significantly increased. Anything inside the fireball is effectively vaporized. ";
				if(airburst) caption+=" Minimum burst height for negligible fallout: "+unit(bc.minimum_height_for_negligible_fallout(kt)*mi2km,"km")+".";
				effectCaptions.push({
					title: "Fireball radius",
					caption: caption,
					radius: effectCircle.radius*m2km,
					fillColor: effectCircle.fillColor,
					strokeColor: effectCircle.strokeColor
				})

			break;

			case "crater":
				c.push([cr[0],"crater_lip",""]);

				var effectCircle = {
					map: MAPUI.map,
					radius:  cr[0]*mi2m,
					fill: true,
					fillColor: "#2E2E2E",
					fillOpacity: .5,
					stroke: true,
					color: "#2E2E2E",
					opacity: 1,
					weight: 1,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Crater lip radius",
				};
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);
				
				effectCaptions.push({
					title: "Crater lip radius",
					id: effectCircle.id,
					radius: effectCircle.radius*m2km,
					fillColor: "#525252",
					fillOpacity: 0.8,
					strokeColor: "#2E2E2E"
				})

				effectCaptions.push({
					title: "Crater depth",
					legendkey: "<span style='padding-left: 4px; padding-right: 1px;text-align: center; display: inline-block;'>&darr;</span>",
					radius: cr[2]*mi2km,
					show_area: false,
					no_highlight: true
				})

				var effectCircle = {
					map: map,
					radius:  cr[1]*mi2m,
					fill: true,
					fillColor: "#2E2E2E",
					fillOpacity: .5,
					stroke: true,
					color: "#2E2E2E",
					opacity: 1,
					weight: 1,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Crater inner radius",
				};
				circs++;
				c_radii[det_index][circs] = newCircle(effectCircle,marker,pos);

				effectCaptions.push({
					title: "Crater inside radius",
					topinsert: "<div><a class='effectImage' href='"+imageAssets+"craterdiagram.png' title='Click to enlarge this image' target='_blank' onclick='show_image(this); return false;'><img src='"+imageAssets+"craterdiagram.png'></a></div>",
					radius: effectCircle.radius*m2km,
					fillColor: effectCircle.fillColor,
					fillOpacity: .5,
					strokeColor: effectCircle.strokeColor
				})

			break;
			
			/*
			case "cep":
				var effectCircle = newCircle({
					map: map,
					radius:  c[rec][0]*mi2m,
					fill: false,
					fillColor: "#0000FF",
					fillOpacity: 0,
					stroke: true,
					color: "#"+colorStep(c[rec][0],50,"8080FF","0000FF"),
					opacity: .8,
					weight: 1,
					zIndex: (circs+1)+(det_index+1)*10,
					title: "Circular Error Probable ("+c[rec][2]+"%)",
				},marker,pos);
				c_radii[det_index][circs] = effectCircle;

				var caption ="The radius (based on the user-defined CEP of "+unit(cep_ft*ft2km,"km")+") where the bomb or warhead has a "+c[rec][2]+"% chance of landing.";
				legend1 = "<p><div class='legendkey' index='"+det_index+"' radius='"+(c[rec][0]*mi2m)+"' style='background-color: #"+background_color+"; border: 1px solid #"+colorStep(c[rec][0],50,"8080FF","0000FF")+";'></div> Circular Error Probable ("+c[rec][2]+"%): "+unit(c[rec][0]*mi2km,"km",{show_area:true}) + "<br><small class='caption'>"+caption+"</small>"+legend1;			
			break;
			*/
		};
		circs++;
	};

	//reverse add the captions
	for(var i = effectCaptions.length-1; i>=0;i--) {
		var ec = effectCaptions[i];
		var o = "";
		o+=`<div class="effectCaption" `;
		if(typeof ec.no_highlight=="undefined") {
			o+=`index="${det_index}" radius="${ec.radius}"`;
		}
		o+=">";
		if(typeof ec.topinsert !="undefined") o+=ec.topinsert;
		o+=`<div class="effectCaptionHeader">`;
		o+=`<div class="legendkey" index="${det_index}" radius="${ec.radius}" `;
		if(typeof ec.fillOpacity=="undefined") ec.fillOpacity = 0.3;
		if(typeof ec.fillColor!="undefined") o+=`style="background-color: ${("rgba("+hex2rgb(ec.fillColor,true)+","+ec.fillOpacity+")")}; border: 1px solid ${ec.strokeColor};"`;
		o+=`>`;
		if(typeof ec.legendkey!="undefined") o+=ec.legendkey;
		o+=`</div> `;
		o+=`<span class="effectTitleRadius">`;
		o+=`<span class="effectTitle">${ec.title}:</span> `;
		if(typeof ec.radiusTxt == "undefined") {
			var show_area = typeof ec.show_area == "undefined"?true:ec.show_area;
			ec.radiusTxt = unit(ec.radius,"km",{show_area:show_area})
		}
		o+=`<span class="effectRadius">${ec.radiusTxt}</span>`;
		o+=`</span>`;
		o+=`</div>`;
		if(typeof ec.caption!="undefined") o+=`<div class="caption">${ec.caption}</div>`;
		o+=`</div>`;
		if(typeof ec.clear != "undefined" && ec.clear==true) o+="<br style='clear:both;'/>";
		legend1+=o;
	}


	if(airburst) {
		legend1+="<p><small>";
		if(hob_ft||hob_ft===0) {
			legend1+= "*Detonation altitude: "+unit(hob_ft*ft2km,"km",{"prefer_smaller":true})+".";
			if(hob_opt==1) {
				legend1+=" (Chosen to maximize the "+unit(hob_opt_psi,"psi")+" range.)";
			}
		} else {
			legend1+= "*Effects shown for multiple, different detonation altitudes.";
		}
		legend1+="</small></p>";
	}

	legend = legend + legend1;
		
	if(errs.length) {
		legend+="<hr><div id='effectsErrors'>The following errors were encountered trying to implement these settings:";
		legend+="<ul>";
		for(var i=0;i<errs.length;i++) {
			legend+="<li>"+errs[i]+"</li>";		
		}
		legend+="</ul></div>";
	}

	legend = legend + "<hr><small>Note: Rounding accounts for inconsistencies in the above numbers."
	if(kt>20000) legend = legend + " Yields above "+ktOrMt(20000,false,false,true)+" are derived from a scaling of "+ktOrMt(20000,true)+" yields, and are not as validated as those under "+ktOrMt(20000,true)+".";
	if(kt<1) legend = legend + " Yields under "+ktOrMt(1,false)+" are derived from a scaling of "+ktOrMt(1,true)+" yields, and are not as validated as those over "+ktOrMt(1,true)+"."
	legend = legend + "</small>";

	legend+="<div id='legend-multiple'></div>";

	legend = "<div id='legend-text'>"+legend+"</div>";
	legend+= "</div>"; //collapsable content div
	legend+="</div>";
	legends[det_index] = legend;

	if($("#option_autozoom").prop("checked") && (override_autozoom != true)) {
		if(c_radii[det_index][0]) { 
			var biggestBounds = c_radii[det_index][0].getBounds();
			MAPUI.map.fitBounds(biggestBounds); 
		}
	}


	$("#theLegend").html(legend);

	if(dets.length>1) {
		var m_legend = "";
		m_legend+="<hr><small>This map has multiple detonations. The above information is for detonation #<span id='current_legend_det'>"+(det_index+1)+"</span> only.";
		m_legend+=" View other detonation information: "
		m_legend+="<select id='legend_changer' onchange='change_legend(this.value);'>";
		for(var i=0;i<dets.length;i++) {
			if(i==det_index) {
				var chk = " selected";
			} else {
				var chk = "";
			}
			m_legend+="<option value='"+(i)+"'"+chk+">"+(i+1)+"</option>";
		}
		m_legend+="</select>";
		m_legend+=" <a href='#' onclick='edit_dets(); return false;'>Click here</a> to edit the detonation order.";
		m_legend+="</small><span id='det_editor'></span>";
		$("#legend-multiple").html(m_legend);
	}

	$("#thePermalink").html("<hr><big>&nbsp;&raquo; <span id='permalink'>"+permalink()+"</span> &laquo;</big></small>");

	toggleMarkerShadow(marker,false);

	if($("#option_logdata").prop("checked") != true) {
		pos_lat = latval(dets[det_index].pos);
		pos_lng = lngval(dets[det_index].pos);

		/* TO ADD:
			- whether presets or geocoding were used for setting
		*/

		var log_obj = {
			ver: ver,
			target_lat: Math.round(pos_lat,3), //we do not record precise lat/lon data
			target_lng: Math.round(pos_lng,3),
			kt: dets[det_index].kt,
			airburst: dets[det_index].airburst==true?1:0,
			casualties: dets[det_index].casualties==true?1:0,
			fallout: dets[det_index].fallout==true?1:0,
			linked: dets[det_index].linked==true?1:0,
			active_dets: (det_index+1),
			embedded: EMBEDDED?1:0,
			platform: navigator.platform,
			useragent: navigator.userAgent, 
			navlang: navigator.language, 
			mode: MAPUI.mode,
			webgl: MAPUI.webGLsupported?1:0,
			hd: isHighDensity()?1:0,
			mobile: isMobile()
		}
		if(user_country) log_obj.user_country = user_country;
		log_det(log_obj);
	}	
	if(collapser) {
		$("#bottomFrame").scrollTop(1000);
	}
}

//updates the legend based on which detonation is selected
function change_legend(index) {
	if(DEBUG) console.log("change_legend",index);
	$("#legend-text").html(legends[index]);
	if(dets.length>1) {
		var m_legend = "";
		m_legend+="<hr><small>This map has multiple detonations. The above information is for detonation #<span id='current_legend_det'>"+(+index+1)+"</span> only.";
		m_legend+=" View other detonation information: "
		m_legend+="<select id='legend_changer' onchange='change_legend(this.value);'>";
		for(var i=0;i<dets.length;i++) {
			if(i==index) {
				var chk = " selected";
			} else {
				var chk = "";
			}
			m_legend+="<option value='"+(i)+"'"+chk+">"+(i+1)+"</option>";
		}
		m_legend+="</select>";
		m_legend+=" <a href='#' onclick='edit_dets(); return false;'>Click here</a> to edit the detonation order.";
		m_legend+="</small><span id='det_editor'></span>";
		$("#legend-multiple").html(m_legend);
	}

}

//for multiple detonations, allows rearrangement of the 'stack'
function edit_dets() {
	var o = '';
	o+="<br><hr>";
	o+="<b>Current detonation list:</b><br>";
	o+="<select id='det_list' size='"+((det_index+1)>8?8:(det_index+1))+"'>";
	for(var i=0;i<=det_index;i++) {	
		if(typeof dets[i].pos!="undefined") {
			o+='<option value="'+i+'">';
			pos_lat = latval(dets[i].pos);
			pos_lng = lngval(dets[i].pos);
			o+="#"+(i+1)+". "+ addCommas(dets[i].kt) +" kt ("+Math.round(pos_lat,6)+", "+Math.round(pos_lng,6)+")";
			o+='</option>';
		}
	}	
	o+='</select>';
	o+='<div style="float:right;">';
	o+='<button onclick="change_det_list(0);">Move up</button>';
	o+='<button onclick="change_det_list(1);">Move down</button><br>';
	o+='<button onclick="change_det_list(2);">Remove detonation</button><br>';
	o+='<button onclick="change_det_list(3);"><b>Apply</b></button>';
	o+='<button onclick="change_det_list(4);">Cancel</button><br>';
	o+="</div>";
	o+='<br clear="both">';
	o+="The last (bottom-most) detonation is always the &quot;active&quot; detonation with the movable marker and changable settings.";
	$('#det_editor').html(o);
}

//updates the detonation list stack based on user actions
function change_det_list(action) {
	var det_list = document.getElementById('det_list');
	var sel = det_list.selectedIndex;
	switch(action) {
		case 0: //move up
		if(sel>0&&det_list.length>1) {
			var item1 = det_list.item(sel);
			var item2 = det_list.item(sel-1);
			var temp_text = item1.text;
			var temp_value = item1.value;
			item1.text = item2.text;
			item1.value = item2.value;
			item2.text = temp_text;
			item2.value = temp_value;
			item2.selected = true;
		}
		break;
		case 1: //move down
		if(sel>-1&&sel<det_list.length-1&&det_list.length>1) {
			var item1 = det_list.item(sel);
			var item2 = det_list.item(sel+1);
			var temp_text = item1.text;
			var temp_value = item1.value;
			item1.text = item2.text;
			item1.value = item2.value;
			item2.text = temp_text;
			item2.value = temp_value;
			item2.selected = true;
		}
		break;
		case 2: //remove
		if(sel>-1) {
			det_list.remove(sel);
		}
		break;
		case 3: //apply 
		var det_clone = clone(dets);
		clearmap();
		for(var i=0;i<det_list.length;i++) {
			dets[i] = det_clone[det_list.item(i).value];
		}
		for(var i = 0; i<dets.length;i++) {
			detonate(true,dets[i],i);
			if(i<dets.length-1) {
				detach(true);
			}
		}
		det_index = dets.length-1;
		document.getElementById('theKt').value = dets[det_index].kt;
		break;
		case 4: //cancel
		document.getElementById('det_editor').innerHTML = "";
		break;
	}
	
}

//makes a circle -- a wrapper of a wrapper at this point
function newCircle(circleOptions,boundTo,position) {
	var opts = circleOptions;
	opts.beforeLayer = "circleLayer";
	opts.pane = "circleLayer";
	opts.position = position;
	if(boundTo) {
		opts.boundObject = boundTo;
		opts.bound = true;
	}
	opts.map = MAPUI.map;
	return MAPUI.circle(opts);
}


//adds a row to the input fields
function addrow(what,label) {
	var mcounter = 0;
	var opt = document.forms["options"];
	for(var i=0; i<opt[what].length;i++) {
		if(opt[what][i].value<0) {
			mcounter++;
		}
	}
	var min = (mcounter+1)*-1;
	var ar = document.getElementById("addrow_"+what);
	ar.appendChild(document.createElement('BR'));
	var inp = document.createElement('INPUT');
	inp.type = "checkbox";
	inp.name = what;
	inp.value = min;
	inp.id = what+"_other_check_"+(min*-1);
	ar.appendChild(inp);
	ar.appendChild(document.createTextNode(' Other: '));
	var inp = document.createElement('INPUT');
	inp.type = "text";
	inp.className = "option_input";
	inp.name = what+"_other_"+(min*-1);
	inp.id = what+"_other_"+(min*-1);
	inp.value = "";
	ar.appendChild(inp);
	ar.appendChild(document.createTextNode(' '+(label==undefined?what:label)+' '));
}

//the permalink link text -- either a single link or a link to the hash generator.
function permalink() {
	waitingforlink = false;
	return "<a href='#' onclick='get_permalink(); return false;'>Permanent link to these settings</a>";
	/*if((dets[0]!=undefined)&&(det_index>0)&&(dets[0].kt!=undefined)) {
		//MULTI PERMALINK
		return "<a href='#' onclick='fetchHash(); return false;'>Generate permanent link to these settings</a>";
	} else {
		//SINGLE PERMALINK
		return "<a href='" + window.location.pathname +"?"+object_to_urlstring(dets[0])+"&zm=" + MAPUI.map.getZoom() + "'>Permanent link to these settings</a>";
	}*/
}

function get_permalink() {
	if((dets[0]!=undefined)&&(det_index>0)&&(dets[0].kt!=undefined)) {
		waitingforlink = true;
		fetchHash();
	} else {
		//single
		var permalink = site+"?"+object_to_urlstring(dets[0])+"&zm=" + Math.round(MAPUI.map.getZoom());
			query_modal(header="Permalink",contents="<p>The URL below will launch the NUKEMAP with its current settings:</p><p id='permalink_url'><input id='permalink_url_input' readonly value='"+permalink+"'/> <button onclick='copyPermalink();'><span id='copyimg'></span><span id='copytxt'>Copy link</span></button></p><p id='permalinkstatus'>&nbsp;</p>",buttons=["OK"]);
		$("#permalink_url_input").select();
		if(DEBUG) console.log("Single permalink",permalink);
	}	
}

function copyPermalink() {
	var url = $("#permalink_url_input").val();
	copyText(url,()=>{
		$("#permalinkstatus").text("Permalink copied to clipboard");
		$("#permalinkstatus").css("color","");
	},(err) => {
		$("#permalinkstatus").text("Error copying permalink to clipboard: "+err);
		$("#permalinkstatus").css("color","red");
	})
}

//converts an object to an url string. used for making permalinks from a det.
function object_to_urlstring(obj,index) {
	var str = '';
	var ind = '';
	if(index!=undefined) ind='['+index+']';
	for(var key in obj) {
		if(key == "pos") {
			pos_lat = latval(obj.pos);
			pos_lng = lngval(obj.pos);
			str+="&lat"+ind+"="+Math.round(pos_lat,7);
			str+="&lng"+ind+"="+Math.round(pos_lng,7);
		} else {
			if(default_det[key]!=undefined) {
				if(isArray(obj[key])) {
					if(arraysEqual(obj[key],default_det[key])==false) {
						str+="&"+key+ind+"="+(obj[key]===true?1:(obj[key]===false?0:obj[key]));		
					}
				} else if((obj[key]!=default_det[key])&&(obj[key]!=null)) {
					str+="&"+key+ind+"="+(obj[key]===true?1:(obj[key]===false?0:obj[key]));
				}
			} else {
				if(obj[key]!=null) {
					str+="&"+key+ind+"="+(obj[key]===true?1:(obj[key]===false?0:obj[key]));			
				}
			}
		}
	}
	return str;
}

//updates the link when a hash is available
function givelink(hash) {
	waitingforlink = false;
	$("#genlink").html("<a href='" + window.location.pathname +"?t="+hash+"'>Permanent link to these settings</a>");
	$("#wait").html("");
}

//centers the marker in the current center of the screen
function centercursor() {
	marker.setLatLon(MAPUI.map.getCenter());
	marker.eventTrigger(["drag","dragend"]);
}

var markerShadowBig, markerShadowSmall;

//adds a new target marker
function dropmarker(pos) {
	if(DEBUG) console.log("dropmarker",pos);
	//remove old marker
	if(marker) marker = marker.remove();

	
	//make new marker
	marker = MAPUI.marker({
		id: "marker",
		position: pos,
		draggable: true,
		className: "marker",
		icon: {
			id: "marker",
			iconUrl: MAPUI.mm.images.markerIcon,
			iconSize: [31*marker_scale, 48*marker_scale],
			iconAnchor: [0*marker_scale, 20.5*marker_scale],
			mousedown: {
				offset: -8*marker_scale,
			}
		},
		shadow: {
			className: "markerShadow",
			iconUrl: MAPUI.mm.images.markerShadowIcon,
			iconSize: [24*marker_scale,15*marker_scale],  
			iconAnchor: [0,0],
			mousedown: {
				className: "markerShadowUp"
			}
		},
		animation: "drop",
		title: "("+Math.round(pos.lat,3)+", "+Math.round(pos.lon,3)+")"
	})

	//Create the marker elements that we can swap between them. 
	//These are created as temporary markers and then hidden using the stylesheet.
	//Note that using the .css() method on markers won't work because the maps rewrite their
	//style dynamically. But changing the css for their ids works.
	if(!markerShadowBig) {
		var markerShadowBigm = MAPUI.marker({
			id: "markerShadowLarge",
			position: [0,0],
			icon: {
				iconUrl: MAPUI.mm.images.markerShadowIcon,
				iconSize: [24*marker_scale,15*marker_scale],  
				iconAnchor: [0,0],
			}
		})
		markerShadowBig = markerShadowBigm.getIcon();
		var markerShadowSmallm= MAPUI.marker({
			id: "markerShadowSmall",
			position: [0,0],
			icon: {
				iconUrl: MAPUI.mm.images.markerShadowIconSmall,
				iconSize: [24*marker_scale,15*marker_scale],
				iconAnchor: [0,0]
			}
		})
		markerShadowSmall = markerShadowSmallm.getIcon();
	}

	marker.eventOn("drag",() => {
		if(MAPUI.webGLsupported) {
			if(typeof dets[det_index] != "undefined") dets[det_index].pos = marker.getLatLon();
			move_windsock(); 
			redraw_fallout();	
		}
	})
	marker.eventOn("dragend",()=> {
		var pos = marker.getLatLon();		
		if(typeof dets[det_index] != "undefined") dets[det_index].pos = pos;
		marker.setTitle("("+Math.round(pos.lat,3)+", "+Math.round(pos.lon,3)+")");
		update_permalink();
		if(!MAPUI.webGLsupported) {
			move_windsock(); 
			redraw_fallout();	
		}
	})
	
}

/* Allows the toggling of the big and small shadows. */
function toggleMarkerShadow(marker,shadowState) {
	if(!shadowState) {
		marker.shadow.setIcon(markerShadowSmall);
	} else {
		marker.shadow.setIcon(markerShadowBig);
	}
}

//updates the permalink
function update_permalink() {
	if($("#permalink").length>0) $("#permalink").html(permalink());
	if(sample_marker) update_sample(); //also updates the sampler if it is there
}

//"detaches" the current marker from the rings, allows for a new detonation to be attached to a new marker
function detach(preserve_det) {
	if(DEBUG) console.log("detach",dets);
	pos = marker.getLatLon();
	stop_fallout();
	if(preserve_det!==true) {
		
		if(typeof dets[det_index]!="undefined" && typeof dets[det_index].pos!="undefined"){ //avoids "phantom" dets with no data in them
			det_index++;
			dets[det_index] = {};
		}
	}
	dropmarker(pos);
}

//goes to a preset location from menu
function jumpToSitePreset(val=undefined) {
	if(typeof val=="undefined") return false;
	var d = menuPresets().sites[+val];
	if(typeof d == "undefined")  return false;
	moveMarkerAndMap(d.lat,d.lng,true);
}

//more rigorous function for simultaneous moving the map and marker to 
//a new destination. perhaps overkill, but really tries to make sure that
//the marker and map moved. -- may not be needed anymore, since I think I fixed the underlying
//issue that was causing the problems (needing to normalize the coordinates for panning)
function moveMarkerAndMap(lat=undefined,lng=undefined,fit_to_det=true,bounds=undefined) {
	if(typeof lat=="undefined"||typeof lng=="undefined"||isNaN(lat)||isNaN(lng)) {
		if(DEBUG) console.error("moveMarkerAndMap had invalid values",lat,lng);
		return false;
	}
	marker.setLatLon({lat:lat,lon:lng});
	marker.eventTrigger(["drag","dragend"]);
	MAPUI.map.panTo({lat:lat,lon:lng},false);
	setTimeout(()=> {
		var pos = marker.getLatLon();
		var round_precision = 0; //how close the lat/lng values need to be. 0 seems to be OK.	
		var chk_lat =  Math.round(normLat(lat),round_precision);
		var chk_lng =  Math.round(normLng(lng),round_precision);
		var mrk_lat = Math.round(normLat(pos.lat),round_precision);
		var mrk_lng = Math.round(normLng(pos.lon),round_precision);
		if(mrk_lat!=chk_lat || mrk_lng!=chk_lng) {
			if(DEBUG) console.log("moveMarkerAndMap: marker did not move!");
			if(DEBUG) console.log(chk_lat,mrk_lat,chk_lng,mrk_lng,pos);
			moveMarkerAndMap(lat,lng,fit_to_det,bounds)
			return false;
		}
		
		if(fit_to_det) {
			if(typeof c_radii[det_index]!="undefined" && typeof c_radii[det_index][0]!="undefined") {
				var biggestBounds = c_radii[det_index][0].getBounds();
				MAPUI.map.fitBounds(biggestBounds); 
				var fitted = true;
			}
		} 
		if(!fitted) {
			if(bounds) {
				MAPUI.map.fitBounds(bounds);
			} else {
				MAPUI.map.setZoom(12);
			}
		}
		var mapcenter = MAPUI.map.getCenter();
		var map_lat = Math.round(mapcenter.lat,round_precision);
		var map_lng = Math.round(mapcenter.lon,round_precision);
		if(normLat(map_lat)!=normLat(chk_lat) || normLng(map_lng)!=normLng(chk_lng)) {
			if(DEBUG) console.log("moveMarkerAndMap: map did not move!");
			console.log(map_lat,chk_lat,map_lng,chk_lng);
			moveMarkerAndMap(lat,lng,fit_to_det,bounds)
			return false;
		}
	},50);
}
	

//changes the various weapons fields based on the preset dropdown
function settingsFromPreset(val) {
	if(typeof val=="undefined" || isNaN(val)) return false;
	var d = menuPresets().nukes[+val];
	if(typeof d=="undefined") return false;
	var yield = +d.kt;
	var airburst = +d.airburst==1?true:false;
	var fission = +d.ff*100;
	var hob = +d.hob;
	var hob_unit = d.hob_unit;
	$("#theKt").val(yield);
	var hob_vals = ["ft","m","mi","km"];
	if(airburst) {
		$("#hob_airburst").prop("checked",true);
		if(typeof hob !="undefined" && !isNaN(hob)) {
			$("#hob_option_height").prop("checked",true);
			$("#hob_h").val(hob);
			$("#hob_h_u").val(hob_vals.indexOf(hob_unit));
		} else {
			$("#hob_option_opt").prop("checked",true);
		}
	} else {
		$("#hob_surface").prop("checked",true);
		$("#hob_option_opt").prop("checked",true);
		$("#hob_h").val(default_det.hob);
		$("#hob_h_u").val(hob_vals.indexOf("ft"));
	}
	$("#fallout_fission").val(fission);
}


function clearmap() {
	kt = false;
	$("#theLegend").html("");
	$("#thePermalink").html("");
	for(var i=det_index;i>=0;i--) {
		if(c_radii[i]!==undefined) {
			if(c_radii[i].length) {
				for(var c=c_radii[i].length-1;c>=0;c--) {
					c_radii[i][c] = c_radii[i][c].remove();
				}
			}
			c_radii[i] = undefined;
		}
	}
	c_radii = [];
	det_index = 0;
	dets = [];

	if(typeof placeMarkers!="undefined") {
		if(placeMarkers.length) {
			for(var i=0; i<placeMarkers.length;i++) {
				placeMarkers[i] = placeMarkers[i].remove();
			}
		}
		placeMarkers = [];
	}
	if(fallout_contours.length) {
		for(var i=0;i<fallout_contours.length;i++) {
			if(fallout_contours[i]) {
				if(fallout_contours[i].length) {
					for(var x=0;x<fallout_contours[i].length;x++) {	
						fallout_contours[i][x] = fallout_contours[i][x].remove();
					}
				}
				fallout_contours[i] = undefined;
			}
		}
		fallout_contours = [];
		stop_fallout();
	}
	toggleMarkerShadow(marker,true);
}

var mapLayers = []; var tileLayers = []; var tileLayerList = []; var layerControl;

function init(mapCenter, mapZoom=undefined, mapOnLoad) {

	if(DEBUG) console.log("init",mapCenter,mapZoom,MAPUI.ready);
	
	$("#loadingCap").html("Initializing map...");

	var default_center = [40.72422, -73.99611];

	/* initialize geocoder */
	geocoder = new nmgc("NUKEMAP",processGeocodingResults,function(err) {
		console.log("Geocoder error",err);
	});

	if(!mapCenter) {
		//check if user location (IP based) script has loaded successfully... if not, just go to default
		if(typeof user_location!="undefined") {
			if(typeof user_location.closest!="undefined") {
				mapCenter = {lat:user_location.closest.lat,lng:user_location.closest.lon};
				if(typeof user_location.country!="undefined") {
					//will set distance units to imperial if use is in one of the three countries that uses them
					if(user_location.country=="US" || user_location.country=="LR" || user_location.country == "MM") {
						units.selected[units.TYPE.UNITS_DISTANCE] = units.MODE.UNITS_IMPERIAL;
					}
				}
			} else {
				mapCenter = default_center;
			}
		} else {
			mapCenter = default_center;
		}
	}
	if(mapZoom==undefined) mapZoom = 12;

	mapCenter = MAPUI.mm.latLon(mapCenter);

	MAPUI.initMap({
		container: "theMap",
		position: mapCenter, 
		zoomControl: false, 
		zoom: mapZoom,
		padding: 50
	},(map)=>{

		$('#loadingMap').hide();
		map_loaded_ok = true;
		if(DEBUG) console.log("initMap.onLoad",MAPUI,MAPUI.map,MAPUI.map._map._loaded);

		/* enable controls */

		/* layer control */
		var l = MAPUI.mm.baseLayers;
		if(Object.keys(MAPUI.mm.baseLayers).length>1) {
			MAPUI.addLayerControl({
				position:"topleft",
				mapChecks: [ //will be ignored by raster
					{
						name: "Labels",
						hover: "Determines whether the map text labels (e.g., city names) are displayed.",
						selected: true,
						onchange: function(checked) {		
							MAPUI.mm.mGL.options.showLabels = checked;			
							MAPUI.map._map.style.stylesheet.layers.forEach((layer)=>{
								if (layer.type === 'symbol') {
									MAPUI.map._map.setLayoutProperty(layer.id,"visibility", checked?"visible":"none");
								}
							});
						}
					}
				]				
			});
		}
			
		MAPUI.addZoomControl({position:"bottomright",visualizePitch: true, showCompass: false});

		MAPUI.addScaleControl({position:"topright",units:0});

		/* enable buttons */
		$("button, input, select").each((e,b)=>{ $(b).prop("disabled",false);});
	
		MAPUI.map.eventOn("zoomend",() => { update_permalink() });

		dropmarker(MAPUI.map.getCenter());
		if(typeof mapOnLoad == "function") mapOnLoad.call(MAPUI.map);

	},(err) => {
		$('#loadingMap').bind('blur change click dblclick error focus focusin focusout hover keydown keypress touch keyup load mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup resize scroll select submit touch touchstart wheel', function(event){
			event.stopPropagation();
			event.stopImmediatePropagation();
		});
		error_displayed = true;
		
		$("#theSettings button, #theSettings input, #theSettings select").each((e,b)=>{ $(b).prop("disabled",true);});

		$("#loadingMap").show();
		$("#loadingMapMarker").html("<div id='atomqmark'>?</div>");
		$("#loadingMapMarker").css("filter","blur(0.5vh)");
		$("#loadingCap").html("<span style='color: red; font-weight: bold;'>Error loading map</span>");
		console.error("Fatal map error",err);
		setTimeout(()=>{
			malert("There was a fatal error loading the map. Please try back again later.");
		},50);
	})
}

function expand_div(arrow) {
	if(map_loaded_ok) {
		if($(arrow).attr("expanded") == "1") {
			$(arrow).removeClass("expanded");
			$(arrow).attr("expanded","0");
			$("#"+$(arrow).attr("div")).slideUp();
		} else {
			$(arrow).addClass("expanded");
			$(arrow).attr("expanded","1");
			$("#"+$(arrow).attr("div")).slideDown();
		}
	}
}

function add_sample_marker(button_id) {
	if(sample_marker) {
		sample_marker = sample_marker.remove();
		if(button_id) $("#"+button_id).html("Inspect location");
	} else {
		if(dets.length>0) {
			pos = marker.getLatLon();

			zoom = MAPUI.map.getZoom();

			var angle = 45; //default angle
		
			if(dets[det_index].fallout==true) {
				angle = dets[det_index].fallout_angle+180;
			}
				
			var R = 6371; // km

			//we should set this somewhat more usefully, like within the radius of the largest circle
			//does c_radii change with dets?
			if(typeof c_radii[det_index]=="undefined") {
				var d = (16-zoom)*2-3; //km
			} else {
				var d = c_radii[det_index][0].getProperty("radius") * 0.8 / 1000; //80% of largest radius
			}

			var pos_lat = latval(pos);
			var pos_lng = lngval(pos);

			var lat1 = pos_lat*deg2rad;
			var lon1 = pos_lng*deg2rad;
			var brng = (angle)*deg2rad;
			var lat2 = Math.asin( Math.sin(lat1)*Math.cos(d/R) + 
						  Math.cos(lat1)*Math.sin(d/R)*Math.cos(brng) );
			var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(d/R)*Math.cos(lat1), 
								 Math.cos(d/R)-Math.sin(lat1)*Math.sin(lat2));	

			var pos = {lat:lat2*rad2deg, lon:lon2*rad2deg};
			sample_marker = MAPUI.marker({
				id: "probe",
				position: pos,
				map: MAPUI.map,
				className: "marker",
				draggable: true,
				icon: {
					id: "probe",
					iconUrl: MAPUI.mm.images.probeIcon,
					iconSize: [40*marker_scale, 43*marker_scale],
					iconAnchor: [4*marker_scale,22*marker_scale],
					mousedown: {
						offset: -8*marker_scale,
					}
				},
				shadow: {
					className: "markerShadow",
					iconUrl: MAPUI.mm.images.probeShadowIcon,
					iconSize: [24*marker_scale,15*marker_scale],
					iconAnchor: [0,0],
					mousedown: {
						className: "markerShadowUp"
					}
				},
				title: "Drag to inspect conditions at a given position on the map ("+Math.round(latval(pos),3)+", "+Math.round(lngval(pos),3)+")",
				animation: "drop",
			});
			sample_marker.eventOn("dragend",function() { update_sample(); });
			if(button_id) $("#"+button_id).html("Remove inspector");
			update_sample();
		}
	}
}

//these are set whenever the control is changed -- to keep it consistent when you move things around
var default_pf = 1;
var default_hr = 24;
var arbitrary_hr = 0;
var arbitrary_pf = 0;

var list_hrs = [1,2,3,5,12,24,36,48,72,"-",-1];

var list_pfs = [
	[1,"in the open"],
	[1.5,"in an automobile"],
	[0,"-"],
	[2,"inside a 1-story frame house"],
	[10,"basement of a 1-story frame house"],
	[0,"-"],
	[3,"inside a 2-story brick-veneer house"],
	[20,"basement of a 2-story brick-veneer house"],
	[0,"-"],
	[7,"in the 2nd floor of a 3-story brick building"],
	[50,"basement of a 3-story brick building"],
	[0,"-"],
	[10,"top or ground floors of a multi-story concrete building"],
	[20,"center of a multi-story concrete building"],
	[100,"basement of a multi-story concrete building"],
	[1000,"sub-basement of a multi-story concrete building"],
	[0,"-"],
	[-1,"Custom protection factor..."],
];



function update_sample() {
	var o='';
	if(dets[0]&&sample_marker&&dets[0].kt) {
		
		o+= "<hr><b>Information at sample point:</b><br>";
		var sample_pos = sample_marker.getLatLon();
		sample_marker.setTitle("Drag to examine conditions at a given position on the map ("+Math.round(latval(sample_pos),3)+", "+Math.round(lngval(sample_pos),3)+")");

		var sample_lat = latval(sample_pos);
		var sample_lng = lngval(sample_pos);

		o+= "<ul>";	

		if(det_index>5) {
			var only_nonzero = true;
		} else {
			var only_nonzero = false;
		}
		for(var i=0;i<=det_index;i++) {
			oo='';
			var non_zero = false;
			var dets_to_display = 0;
			if(dets[i].kt) {
				det_lat = latval(dets[i].pos);
				det_lng = lngval(dets[i].pos);
				var dist_km = distance_between(det_lat, det_lng, sample_lat,sample_lng);

				var dist_mi = dist_km*km2mi;
				if(dets[i].airburst&&dets[i].hob_opt>0&&dets[i].hob_ft) {
					var slant_dist_mi = Math.sqrt(Math.pow(dets[i].hob_ft*ft2mi,2)+Math.pow(dist_mi,2));
				}

				if(det_index>0) {
					oo+="<li>Sample point is "+unit(dist_km,"km")+ " from ground zero #"+(i+1)+" ("+ktOrMt(dets[i].kt,true);
					if(dets[i].airburst&&dets[i].hob_opt>0&&dets[i].hob_ft) {
						oo+=" (slant range "+unit(slant_dist_mi*mi2km,"km")+")";
					}
					oo+=".";		
					if(dets[i].kt>20000) {
						oo+=" (unreliable for yields >20 Mt!)";
					} else if(dets[i].kt<1) {
						oo+=" (unreliable for yields <1 kt!)";
					}
					oo+="</li>";
				} else {
					oo+="<li>Sample point is "+unit(dist_km,"km")+" from "+(det_index>0?"current":"")+" ground zero"
					if(dets[i].airburst&&dets[i].hob_opt>0&&dets[i].hob_ft) {
						oo+=" (slant range "+unit(slant_dist_mi*mi2km,"km")+")";
					}
					oo+=".";
					if(dets[i].kt>20000) {
						oo+=" (unreliable for yields >20 Mt!)";
					} else if(dets[i].kt<1) {
						oo+=" (unreliable for yields <1 kt!)";
					}
					oo+="</li>";
				}
				oo+="<ul>";
				
				oo+="<li>Overpressure: ";
				if(dets[i].airburst) {
					if(dets[i].hob_ft&&dets[i].hob_opt>0) {
						var psi = bc.psi_at_distance_hob(dist_km*km2ft,dets[i].kt,dets[i].hob_ft);
					} else {
						var psi = bc.maximum_overpressure_psi(bc.scaled_range(dist_mi,dets[i].kt),dets[i].airburst);
					}		
				} else {
					var psi = bc.psi_at_distance_hob(dist_km*km2ft,dets[i].kt,0);
				}
				if(!Math.round(psi)) {
					if(typeof psi=="string" && psi.substr(0,1)=="+") {
						oo+=psi+" psi";
						non_zero = true;
					} else if(dets[i].hob_ft||!dets[i].airburst) {
						oo+="0 psi";
					} else {
						if(dist_mi > bc.psi_distance(dets[i].kt,1,dets[i].airburst)) {
							oo+=unit(0,"psi");
						} else { 
							oo+="+"+unit(200,"psi");
							non_zero = true;
						}						
					}
				} else {
					oo+=unit(psi,"psi");
					non_zero = true;
				}

				oo+="</li>";
				if(!dets[i].airburst||dets[i].hob_ft===0) { //I have no idea how to translate wind velocity to arbitrary airbursts, so let's just stick to surface
					oo+="<li>Maximum wind velocity: ";
					var mph = bc.maximum_wind_velocity_mph(bc.scaled_range(dist_mi,dets[i].kt),false);
					if(!Math.round(mph)) {
						if(dist_mi > bc.psi_distance(dets[i].kt,1,dets[i].airburst)) {
							oo+=unit(0,"mph");
						} else {
							oo+="+"+unit(3000,"mph");
							non_zero = true;
						}
					} else {
						oo+=unit(mph,"mph");
						non_zero = true;
					}
					oo+="</li>";
				}	
				oo+="<li>Initial radiation dose: ";
				if(dets[i].airburst&&dets[i].hob_ft&&dets[i].hob_opt>0) { //get slant distance
					checkdist = slant_dist_mi;
				} else {
					checkdist = dist_mi;
				}
				if(dets[i].kt>20000) {
					oo+=" <small>cannot calculate for yields greater than "+ktOrMt(20000,true)+"</small>"
				} else {
					var rem = bc.initial_nuclear_radiation(checkdist,dets[i].kt,dets[i].airburst);
					if(!Math.round(rem)) {
						if(checkdist > bc.initial_nuclear_radiation_distance(dets[i].kt,1,dets[i].airburst)) {
							oo+=unit(0,"rem");
						} else { 
							oo+="<small>too close to ground zero (potentially +"+unit(20000,"rem")+")</small>";
							non_zero = true;						
						}
					} else if (rem>20000){ 
						oo+="<small>too close to ground zero (potentially +"+unit(20000,"rem")+")</small>";
						non_zero = true;
					} else {
						oo+=unit(rem,"rem");
						non_zero = true;
					}
				}
				oo+="</li>";

				oo+="<li>Thermal radiation: ";
				if(dets[i].airburst&&dets[i].hob_ft&&dets[i].hob_opt>0) { //get slant distance
					checkdist = slant_dist_mi;
				} else {
					checkdist = dist_mi;
				}	
				var therm = bc.thermal_radiation_q(checkdist,dets[i].kt,dets[i].airburst);
				if(!Math.round(therm,1)) {
					if(dist_mi > bc.thermal_distance(dets[i].kt,"_1st-50",dets[i].airburst)) {
						oo+=unit(0,"cal");
					} else { 
						oo+="<small>too close to ground zero (potentially +"+unit(350000,"cal")+")</small>";
						non_zero = true;
					}
				} else {
					oo+=unit(therm,"cal");
					non_zero = true;
				}
				oo+="</li>";
				
				if(fallout_current) {
					
					rad_hr = h1_dose_at_point(sample_lat,sample_lng,det_lat,det_lng);
					oo+="<li>Fallout exposure:<ul>";
					if(!rad_hr) {
						oo+="<li>No significant fallout exposure at position.";
					} else {
						oo+="<li>H+1 dose rate is "+addCommas(rad_hr)+" rad/hr <input type='hidden' id='fallout_exposure_rate_"+i+"' value='"+rad_hr+"'/>";
						oo+="<li>Time of arrival at location is ";
						var toa = (dist_mi/fallout_current.wind); //hours
						var n = new Date(0,0);
						n.setSeconds(toa * 60 * 60);
						oo+=(n.toTimeString().slice(0, 8)) + "<input type='hidden' id='fallout_exposure_toa_"+i+"' value='"+toa+"'/>";;	
						oo+="<li>Dose rate at time of arrival will be "+addCommas(Math.round(rad_hr*Math.pow(toa,-1.2)))+" rad/hr";

						var hr = default_hr, pf = default_pf; 

						oo+="<li>Exposure time: ";
						oo+="<select id='fallout_exposure_hr_"+i+"' onchange=\"update_exposure("+i+");\">";
						var custom_hr = false;
						for(var x in list_hrs) {
							oo+="<option value='"+list_hrs[x]+"'";
							if(list_hrs[x] == default_hr) oo+=" selected"
							if(list_hrs[x]==-1) {
								oo+=">Custom time...</option>";
								custom_hr = true;
							} else if(list_hrs[x]=="-") {
								oo+="<option disabled>â”€â”€â”€â”€â”€â”€</option>";
							} else {
								if(custom_hr) {
									oo+=">User-selected time = "+list_hrs[x]+ " hour"+(list_hrs[x]!=1?"s":"")+"</option>";
								} else {
									oo+=">"+list_hrs[x]+" hour"+(list_hrs[x]==1?"":"s")+"</option>";
								}
							}
						}
						oo+="</select><br>";

						oo+="<li>Protection factor: ";
						oo+="<select id='fallout_exposure_pf_"+i+"' style='width: 200px;'  onchange=\"update_exposure("+i+");\">";
						var custom_pf = false;
						for(var x in list_pfs) {
							if(list_pfs[x][0]==0) {
								oo+="<option disabled>â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€</option>";
							} else if(list_pfs[x][0]==-1) {
								oo+="<option value='"+list_pfs[x][0]+"'";
								oo+=">"+list_pfs[x][1]+"</option>";	
								custom_pf = true;					
							} else {
								oo+="<option value='"+list_pfs[x][0]+"'";
								if(list_pfs[x][0]==pf) oo+=" selected";
								if(custom_pf) {
									oo+=">"+list_pfs[x][1]+"</option>";
								} else {
									oo+=">"+addCommas(list_pfs[x][0])+" = "+list_pfs[x][1]+"</option>";
								}
							}
						}

						oo+="</select>"
						oo+="<li>Total exposure dose: ";
						oo+="<span id='fallout_exposure_dose_"+i+"'>";
						oo+=exposure_dose(rad_hr,hr,toa,pf);
						oo+="</span>";
						oo+="</ul>";
					}
					oo+="</li>";
				}
				oo+="</ul>";
			}
			if(!only_nonzero) {
				o+=oo;		
				dets_to_display++;	
			} else if (non_zero==true) {
				o+=oo;
				dets_to_display++;	
			} else {
				oo='';
			}
		}
		if(dets_to_display==0) o+="<li>None of your detonations have measurable immediate effects at the selected point.</li>";
		o+="</ul>";
	}
	if(det_index>0) {
		o+="<small>Note: The effects are kept separate here for multiple detonations, because they don't necessarily add up in a linear fashion.";
		if(only_nonzero) o+=" Also, because there are so many detonations in your current simulation, information is only shown when it has non-zero values.";
		o+="</small>";
	
	}

	$("#sample_info").html(o);

}

function update_exposure(i) {
	var old_default_hr = default_hr;
	var old_default_pf = default_pf;
	default_hr=$('#fallout_exposure_hr_'+i).val();
	default_pf=$('#fallout_exposure_pf_'+i).val();
	if(default_hr==-1) {
		var input_hr = window.prompt("Enter in the amount of hours you are curious to calculate the exposure for (decimal hours only: e.g., 1.5 hours, not 01:30). Note that the accuracy of the exposure calculation decreases with times significantly greater than 100 hours.");
		if(parseFloat(input_hr)<=0||input_hr==''||input_hr==null) {
			$('#fallout_exposure_hr_'+i).val(old_default_hr);
			default_hr = old_default_hr;
		} else {
			arbitrary_hr = parseFloat(input_hr);
			list_hrs.push(arbitrary_hr);
			default_hr = arbitrary_hr;
			$("#fallout_exposure_hr_"+i).append("<option value='"+arbitrary_hr+"'>User-selected time = "+arbitrary_hr+ " hour"+(arbitrary_hr!=1?"s":"")+"</option>");
			$("#fallout_exposure_hr_"+i).val(arbitrary_hr);
		}
	} 
	if(default_pf==-1) {
		var input_pf = window.prompt("Enter a protection factor (PF) you would like to use. A protection factor of 2 corresponds to a total reduction of radiation exposure by a factor of 2, for example. Protection factors cannot be less than 1.");
		if(parseFloat(input_pf)<=1||input_pf==''||input_pf==null) {
			$('#fallout_exposure_pf_'+i).val(old_default_pf);
			default_pf = old_default_pf;
		} else {
			arbitrary_pf = parseFloat(input_pf);
			list_pfs.push([arbitrary_pf,"User-selected PF = "+addCommas(arbitrary_pf)]);
			default_pf = arbitrary_pf;
			$("#fallout_exposure_pf_"+i).append("<option value='"+arbitrary_pf+"'>User-selected PF = "+addCommas(arbitrary_pf)+"</option>");
			$("#fallout_exposure_pf_"+i).val(arbitrary_pf);
		}
	} 

	$('#fallout_exposure_dose_'+i).html(exposure_dose($('#fallout_exposure_rate_'+i).val(),$('#fallout_exposure_hr_'+i).val(),$('#fallout_exposure_toa_'+i).val(),$('#fallout_exposure_pf_'+i).val()));
}

//gives total exposure (rads) over time given initial activity (rad/hr), duration of exposure (hours), time of arrival (hours), protection factor
//coeff_mode determines which the fission product decay coefficient is used
//coeff_mode = 0 = standard Way and Wigner (1948) t^-1.2 mode for all times. not terrible but also a little inaccurate esp. for long term. (https://link.springer.com/chapter/10.1007%2F978-3-642-77425-6_27)
//coeff_mode = 1 = uses a variable coefficient algorithm derived from Hunter and Ballou, "Fission Product Decay Rates," Nucleonics (November 1951), page C-2
//coeff_mode = 1 = currently not supported!
function exposure_dose(rad_hr,hr,toa,pf, coeff_mode = 0) {
	hr = parseFloat(hr);
	pf = parseFloat(pf);
	toa = parseFloat(toa);
	rad_hr = parseInt(rad_hr);
	if(pf<1) pf = 1;
	oo=""
	if(hr>toa) {
		switch(coeff_mode) {
			default: case 0:
				var rads = Math.round(5*rad_hr*(Math.pow(toa,-0.2)-Math.pow(hr,-0.2))/pf);
			break;/*
			case 1:
				var rads = 0;
				var hrs = hr;
				var rh = rad_hr;
				var rates = [
					[24,-1.11],
					[24*4, -1.25],
					[24*100, -1.03],
					[24*365*3, -1.60];
				]
				for(var i in rates) {
					var ce = rates[i][0];
					if(hrs<=rates[i][0]) {
						rad += Math.round(5*rad_hr*(Math.pow(toa,ce+1)-Math.pow(hrs,ce+1))/pf)
					
					}
				}
							
			
			break;*/
		}
		
		//linear fit to NAPB-90 data, table B-2, which is just LNT. 
		var c_risk =0.0303*rads-0.2065;
		if(c_risk<1) {
			c_risk = "less than 1%";
		} else if(c_risk>100) {
			c_risk = "100%";
		} else {
			c_risk = Math.round(c_risk)+"%";
		}
		
		//incapacitation and death info comes from Jorma K. Miettinen, "Enhanced Radiation Warfare," BAS 33, no. 7 (1977), 32-37.
		//using rem here as a proxy for rads -- close-enough for our purposes.
		oo+= unit(rads,"rem",{class:"bold"})+" ";
		//"<b>"+addCommas(rads)+"</b> rads ";
		if(rads>=17000) {
			oo+="<small>(fatal, incapacitating within five minutes, death within one day)</small>"; //no need to talk about survivors		
		} else if(rads>=7000) {
			oo+="<small>(fatal, incapacitating within five minutes, death within one to two days)</small>"; //no need to talk about survivors		
		} else if (rads>=1000) {
			oo+="<small>(fatal, incapacitating within five minutes with recovery period, death within four to six days)</small>"; //no need to talk about survivors		
		} else if (rads>=1000) {
			oo+="<small>(fatal, in two weeks or less)</small>"; //no need to talk about survivors
		} else if(rads>=500) {
			oo+="<small>(likely fatal, in about 1 month; "+c_risk+" of survivors will eventually die of cancer as a result of exposure)</small>";
		} else if(rads>=250) {
			oo+="<small>(sickness inducing, medical care would be required, some deaths in 30-60 days; "+c_risk+" of survivors will eventually die of cancer as a result of exposure)</small>";
		} else if(rads>=100) {
			oo+="<small>(sickness inducing, less than 5% chance of death in 60 days; "+c_risk+" of survivors will die of cancer as a result of exposure)</small>";
		} else if(rads>0) {
			oo+="<small>(no immediate symptoms; "+c_risk+" of survivors will die of cancer as a result of exposure)</small>";
		}
	} else {
		oo+= "0 rads <small>(because fallout has not yet arrived)</small>";
	}
	return oo;
}

function jumpToGeocode() {
  var address = $("#geocodeInput").val();
	var skip_geocode = false;
	var ad = address.split(",");
	if(ad.length==2) {
		if(!isNaN(ad[0])&&!isNaN(ad[1])) { //interpret as lat/lng
			if((+ad[0]<=90||+ad[0]>=-90)&&(+ad[1]<=180||+ad[1]>=-180)) {
				skip_geocode = true;
				moveMarkerAndMap(+ad[0],+ad[1],fit_to_det=true);
			}
		}
	}
	if(!skip_geocode) {
		if(DEBUG) console.log("Geocoding: "+address);
		geocoder.query(address);
	}
}

//function to process mapbox geocoding results
//this is here, and not in map_ui.js, because MISSILEMAP will do different stuff with the info
function processGeocodingResults(results) {
	//console.log(results);
	//make lat,lon from geocoding results
	if(DEBUG) console.log("processGeocodingResults",results);
	if(results.status=="success") {
		var lat = results.lat;
		var lng = results.lng;
		var bbox = results.bbox;
	} else if(results.status=="none") {
		malert("No usable results were returned for your location search.");
		return false;		
	} else {
		if(results.status=="fail") {
			malert("There was an error processing your address lookup query. Please try again later.");
		}
		if(DEBUG) console.log("geocoding.fail",results);
		return false;
	}
	if(typeof lat == "undefined" || typeof lng == "undefined") {
		malert("No usable results were returned for your location search.");
		return false;	
	}
	var bounds = undefined;
	if(bbox) bounds = bbox;
	moveMarkerAndMap(lat,lng,true,bounds);
}

function permalinks_to_det(permalink_array) {
	var p = permalink_array;
	if(p["kt"]==undefined) return false;
	if(Array.isArray(p["kt"])) {
		var pp = [];
		for(var i=0;i<p["kt"].length;i++) {
			for(var k in Object.keys(p)) {
				var key = Object.keys(p)[k];
				if((p[key][i]!==undefined)&&(key!="zm")) {
					pp[key] = p[key][i];
				}
			}
			permalinks_to_det(pp);
		}
	} else {
		//one
		if(dets[det_index]!=undefined) det_index++;
		var det_obj = {...default_det};
		for(var i in Object.keys(p)) {
			var key = Object.keys(p)[i];
			switch(key) {
				case "zm":
					//ignore
				break;
				case "lat": case "lng":
					det_obj["pos"] = {lat:p["lat"],lon:p["lng"]};
				break;
				case "psi":case "rem": case "therm": case "fallout_rad_doses":
					det_obj[key] = decodeURIComponent(p[key]).split(","); //sometimes commas get URLencoded by browsers or whatever
				break;
				case "hob": //backwards compatibility
					det_obj["hob_ft"] = +p["hob"];
					if(typeof p["hob_opt"]=="undefined") det_obj["hob_opt"] = 2;
				break;
				case "hob_ft": 
				det_obj["hob_ft"] = +p["hob_ft"];
				if(typeof p["hob_opt"]=="undefined") det_obj["hob_opt"] = 2;
				break;
				default:
					if((default_det[key]===true)||(default_det[key]===false)) {
						det_obj[key] = +p[key]==1?true:false;
					} else {
						det_obj[key] = +p[key];
					}
				break;
			}
		}
		if(DEBUG) console.log("permalinks_to_det",det_obj);
		dets[det_index] = {...det_obj};
		dets[det_index].linked = true;
	}
}

function loadingPermaDiv(toggle) {
	if(toggle) {
		var d = document.createElement('DIV');
		d.id = "loadingPermaDiv";
		d.innerHTML = "<h2>Loading permalink settings... <img src='"+imageAssets+"progress.gif'/></h2><small><a href='"+site+"'>Click here to cancel.</a>";
		document.getElementById("bottomFrame").appendChild(d);
	} else {
		var d =	document.getElementById("loadingPermaDiv");
		d.parentNode.removeChild(d);
	}
}

function hash_request(hash) {
	if(DEBUG) console.log("Getting settings from complete permalink",hash);
	$.ajax({
	  type: "POST",
	  dataType: "json",
	  url: dynamicAssets+"permalink.php",
	  data: { t: hash },
	  success: function(data) {
		if(data.status=="SUCCESS") {
			if(DEBUG) console.log("Permalink data retrieved",data);
			var u = getUrlVars(data.link);
			permalinks_to_det(u);
			if(dets.length) {
				if(DEBUG) console.log("Loading multiple permalinks...",dets);
				init(dets[dets.length-1].pos,parseInt(u["zm"]),function() {
					for(var i = 0; i<dets.length;i++) {
						detonate(true,dets[i],i);
						if(i<dets.length-1) {
							detach(true);
						}
					}
					$('#theKt').val(dets[det_index].kt);
					loadingPermaDiv(false);
				})
			} else {
				if(DEBUG) console.log("Permalink received has no dets",data);
				loadingPermaDiv(false);		
				malert("There was an unspecified error loading the link you followed. Sorry.");
				init();
			}
		} else {
			loadingPermaDiv(false);
			if(DEBUG) console.log("Permalink received error",data);
			malert("There was an error loading the link you followed. Error message: "+data.error);
			init();
		}	  
	  }
	});
}

//generates a permalink hash
function fetchHash(success) {
	$("#permalink").html("Generating permalink... <img src='"+imageAssets+"progress.gif'/>");

	if(DEBUG) console.log("generating hash permalink",dets);
	var perms = '';
	for(var i=0;i<=det_index;i++) {
		perms+=object_to_urlstring(dets[i],i);
	}
	perms+="&zm=" + Math.round(MAPUI.map.getZoom());

	$.ajax({
	  type: "POST",
	  dataType: "json",
	  url: dynamicAssets+"permalink.php",
	  data: { link: perms },
	  success: function(data) {
			if(data.status=="SUCCESS") {
				if(DEBUG) console.log("fetchHash success",data);
				var permalink = site+"?t="+data.hash;
				query_modal(header="Permalink",contents="<p>The URL below will launch the NUKEMAP with its current settings:</p><p id='permalink_url'><input id='permalink_url_input' readonly value='"+permalink+"'/> <button onclick='copyPermalink();'><span id='copyimg'></span><span id='copytxt'>Copy link</span></button></p><p id='permalinkstatus'>&nbsp;</p>",buttons=["OK"]);
				$("#permalink_url_input").select();
				if(DEBUG) console.log("Cached permalink",permalink);
			} else {
				if(DEBUG) console.log("fetchHash success without data",data);
				malert("There was an error creating the link. Please try again. Error message: "+data.error);
			}
	  },
		error: function(jqXHR,textStatus,error) {
			malert("Fetching the complex permalink for these settings failed. Please try again later.\n\nError: "+error);
			if(DEBUG) console.log("fetchHash ajax error",jqXHR,textStatus,error);
		},
		complete: ()=>{
			waitingforlink = false;
			update_permalink();
		}
	});	
}

//converts an airburst to a surface burst
function switch_to_surface() {
	dets[det_index].airburst = false;
	detonate(true,dets[det_index],det_index);
}

//toggles a map overlay
var logo;
function map_logo(remove_it = false) {
	console.log(map_logo,remove_it);
	if(!remove_it && $("#logo").length==0) {
		$("body").append(`<div id="logo" class='nukemap_name'><big>NUKEMAP</big><sub>${ver}</sub></div>`);
	} else {
		$("#logo").remove();
	}
}



//allows you to disable some aspects of interface so you can embed it
function applyLite(settings) {
	var oSettings = settings.split(",");
	if(DEBUG) console.log("lite",oSettings);
	if(oSettings.length>0) {
		$("#endnote").html("<hr><small>You are viewing an embedded version of the NUKEMAP with some of its options or interface limited. For the full NUKEMAP, please <a href='"+site+"'>visit the NUKEMAP homepage</a>.</small>");
	}
	for(i in oSettings) {
		switch(oSettings[i]) {
			case "city":
				$("#city").hide();
				$("#city_hr").hide();
				$("#numbered_2").html((parseInt($("#numbered_2").html())-1)+".");
				$("#numbered_3").html((parseInt($("#numbered_3").html())-1)+".");
				$("#numbered_4").html((parseInt($("#numbered_4").html())-1)+".");
			break;
			case "city_preset":
				$("#city_preset").hide();
			break;
			case "city_input":
				$("#city_input").hide();
			break;
			case "yield":
				$("#yield_div").hide();
				$("#yield_hr").hide();
				$("#numbered_3").html((parseInt($("#numbered_3").html())-1)+".");
				$("#numbered_4").html((parseInt($("#numbered_4").html())-1)+".");
			break;
			case "yield_preset":
				$("#preset").hide();
				$("#preset_br").hide();
			break;
			case "faq":
				$("#faq_line").hide();
			break;
			case "nm3d":
				$("#nukemap3d").hide();
			break;
			case "options":
				$("#basic_options_hr").hide();
				$("#basic_options").hide();
				$("#numbered_4").html((parseInt($("#numbered_4").html())-1)+".");
			break;
			case "advoptions":
				$("#adv_options_hr").hide();
				$("#adv_options").hide();
			break;
			case "social":
				$("#shares_hr").hide();
				$("#shares").hide();
			break;
			case "otheroptions":
				$("#other_options_hr").hide();
				$("#other_options").hide();
			break;
			case "footer":
				$("#footer_hr").hide();
				$("#footer").hide();
			break;
			case "b_clear":
				$("#button_clear").hide();
			break;
			case "b_probe":
				$("#button_probe").hide();
			break;
			case "b_center":
				$("#button_center").hide();
			break;
			case "b_detach":
				$("#button_detach").hide();
			break;
			case "b_other":
				$("#buttons_other").hide();
			break;
			case "b_note":
				$("#button_note").hide();
			break;
			case "detonate":
				$("#detonate_div").hide();
				$("#detonate_hr").hide();
			break;
			case "permalink":
				$("#thePermalink").hide();
			break;
			case "legend_hr":
				hide_legend_hr = true;
			break;
			case "legend":
				$("#theLegend").hide();
			break;
			case "fallout":
				$("#theLegendFallout").css("display","none");
			break;
			case "places":
				$("#theLegendPlaces").hide();
			break;
			case "small":
				var newWidth = 250;
				$("#topFrame").css("width",newWidth-10);
				$("#theLegend").css("font-size","9pt");
				$("#createdby").css("font-size","10pt");
				$("#theMap").css("right",newWidth+20);
				$("#topFrame").css("width",newWidth-10);
				$("#bottomFrame").css("width",newWidth-10);
				$("#theSettings").css("width",newWidth);
				$("#theSettings").css("width",newWidth);
			break;						
			case "classic":
				$("#classic_link").hide();
				$("#classic_link_hr").hide();
			break;
			case "minify":
				$('#topFrame').hide();
				$('#bottomFrame').hide();
				$('#theSettings').addClass('settingsMin');
				$('#theMap').addClass('mapMax');
				$('#hiddenFrame').show();
				map_logo(0);
			break;
			case "createdby": 
				$("#stat_line").hide();
				$("#formore").hide();
			break;
		}
	}
}

//tries to load detonations in an external file
function loadExternalDets(det_file) {
	$.ajax({
	  type: "GET",
	  dataType: "jsonp",
	  url: dynamicAssets+"loadtxt.php",
	  data: { file: det_file },
	  success: function(data) {
		if(data.status=="SUCCESS") {
			var pt = data.txt;
		} else {
			console.log("Could not load external file -- error: "+data.status);
			var pt = "";
		}
		var u = getUrlVars(pt);
		permalinks_to_det(u);
		if(dets.length) {
			init(dets[dets.length-1].pos,parseInt(u["zm"]),function() {
				if(DEBUG) console.log("Loading dets from permalink...")
				for(var i = 0; i<dets.length;i++) {
					detonate(true,dets[i],i);
					if(i<dets.length-1) {
						detach(true);
					}
				}
				$('#theKt').val(dets[det_index].kt);
				loadingPermaDiv(false);
			})
		} else {
			init();
			loadingPermaDiv(false);		
		}
	}
  })
}

var last_wind_check = -1;
var wind_check_delay = 10000;
function getlocalwind() {
	var loc = marker.getLatLon();
	var loc_lat = latval(loc);
	var loc_lng = lngval(loc);
	//prevents spamming of this service
	if(last_wind_check > -1) {
		if(Date.now()-last_wind_check<wind_check_delay) {
			if(DEBUG) console.log("Waiting "+Math.round((wind_check_delay-(Date.now()-last_wind_check))/1000,3)+" seconds before next wind check...");
			$("#get_local_wind").html(`<img src="${imageAssets+"progress.gif"}">`);
			$("#get_local_wind").prop("disabled",true);
			setTimeout(()=>{ getlocalwind() },wind_check_delay-(Date.now()-last_wind_check));
			return false;
		}	
	}
	last_wind_check = Date.now();

	var url = "//api.openweathermap.org/data/2.5/weather?lat="+loc_lat+"&lon="+loc_lng+"&units=imperial&appid=8a6e14520bf547360b7885f3d7d3df66";
	$("#get_local_wind").html(`<img src="${imageAssets+"progress.gif"}">`);
	$("#get_local_wind").prop("disabled",true);

	$.ajax({
	  url: url
	  })
	  .done(function( data ) {
			if(data) {
				console.log("OpenWeatherMap",data);
				if(data.wind) {
					if(!data.wind.deg && data.wind.deg!==0 && !data.wind.speed && data.wind.speed!==0) {
						malert("Sorry, for an unknown reason, the application could not retrieve local wind conditions for the specified location. You might try again later, but it might be that the data source does not have the information.");	  		
					} else if ((data.wind.deg || data.wind.deg===0) && !data.wind.speed && data.wind.speed!==0) {
						malert("The application was able to get the wind direction, but not the wind speed, for specified location.")
						$("#fallout_angle").val(Math.round(data.wind.deg));
						$("#fallout_angle")
					} else if ((data.wind.speed || data.wind.speed===0) && !data.wind.deg && data.wind.deg!==0) {
						malert("The application was able to get the wind speed, but not the wind direction, for specified location.")
						$("#fallout_wind").val(Math.round(data.wind.speed));
					} else {
						$("#fallout_angle").val(Math.round(data.wind.deg));
						$("#fallout_wind").val(Math.round(data.wind.speed));
					}
					update_fallout();
				} else {
					malert("Sorry, for an unknown reason, the application could not retrieve local wind conditions. Please try again later.");	  		
				}
				$("#get_local_wind").html(`Lookup`);
				$("#get_local_wind").prop("disabled",false);
			} else {
				malert("Sorry, for an unknown reason, the application could not retrieve local wind conditions. Please try again later.");
				$("#get_local_wind").html(`Lookup`);
				$("#get_local_wind").prop("disabled",false);
			}
	  });
}

//updates the fallout info
function update_fallout() {
	if(dets[det_index]) {
		dets[det_index].fallout_wind = $("#fallout_wind").val();
		dets[det_index].fallout_angle = $("#fallout_angle").val();
		dets[det_index].ff = $("#fallout_fission").val();
		if(dets[det_index].fallout) {
			if(dets[det_index].hob_ft&&dets[det_index].airburst) {
				do_fallout(dets[det_index].kt,dets[det_index].fallout_wind,dets[det_index].ff,dets[det_index].fallout_angle,"theLegendFallout",dets[det_index].airburst,dets[det_index].hob_ft);
			} else {
				do_fallout(dets[det_index].kt,dets[det_index].fallout_wind,dets[det_index].ff,dets[det_index].fallout_angle,"theLegendFallout",dets[det_index].airburst);
			}
		}
		update_permalink();
	}
}

//simple linear interpolation -- returns x3 for a given y3
function lerp(x1,y1,x2,y2,y3) {
	if(y2==y1) {
		return false; //division by zero avoidance
	} else {
		return ((y2-y3) * x1 + (y3-y1) * x2)/(y2-y1);
	}
}

//loads up SELECTs with presets
function loadPresets() {
	var presets = menuPresets();
	var sites = presets.sites;
	for(var i in sites) {
		var d = sites[i];
		if(typeof d.sep != "undefined" && d.sep==true) {
			$("#presetcity").append(`<optgroup class="select_separator"  label="${d.label}:"></optgroup>`);
		} else {
			$("#presetcity").append(`<option value="${i}" lat="${d.lat}" lng="${d.lng}">${d.name}</option>`);
		}
	}
	var nukes = presets.nukes;
	for(var i in nukes) {
		var d = nukes[i];
		if(typeof d.sep != "undefined" && d.sep==true) {
			$("#preset").append(`<optgroup class="select_separator"  label="${d.label}:"></optgroup>`);
		} else {
			$("#preset").append(`<option value="${i}" kt="${d.kt}" airburst="${d.airburst}" ff="${d.ff}" hob="${(typeof d.hob=="undefined"?"-1":d.hob)}">${d.label}</option>`);
		}
	}
}

/* Functions that will normalize lat/lon values for comparison purposes,
 * because sometimes marker.getLatLon() returns values that are wrapped
 * around the world for some reason... */
function normLat(lat) {
	while(lat<-90) {
		lat+=360;
	}
	while(lat>90) {
		lat+=360;
	}
	return lat;
}
function normLng(lng) {
	while(lng<-180) {
		lng+=360;
	}
	while(lng>180) {
		lng-=360;
	}
	return lng;
}

function updateScaleControl(units) {
	MAPUI.updateScaleControl(units);
}

//modal alert -- something to add later
function malert(msg) {
	alert(msg);
	//$("body").append("<div id='modal'><div id='malert'><div id='malert_msg'>"+msg+"</div><div id='malert_button'><button onclick=\"$('#modal').remove()\">OK</button></div>");
}

/* This is pretty arbitrary at the moment, but should make things a little easier... */
function isMobile() {
	var threshold = 1280;
	if(window.screen.availHeight>window.screen.availWidth) {
		if(window.screen.availHeight<threshold) return 2; //vertical
	} else if(window.screen.availHeight<window.screen.availWidth) {
		if(window.screen.availWidth<threshold) return 1; //horizonal
	}
	return 0; //above threshold
}

if (typeof register == 'function') { register("nukemap2.js"); }