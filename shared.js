//useful conversions
var mi2km = 1.60934;
var mi2m = 1609.34;
var km2ft = 3280.84;
var m2ft = 3.28084;
var ft2m = 0.3048;
var ft2km = 0.0003048;
var ft2mi = 0.000189394;
var m2mi = 0.000621371;
var mi2ft = 5280;
var km2mi = 0.621371;
var km2m = 1000;
var m2km = 1/1000;
var rad2deg = 180/Math.PI;
var deg2rad = Math.PI/180;
var sqkm2sqm = 1000000;
var sqkm2sqmi= 0.386102;
var sqkm2sqft= 1.076e+7;

function colorStep(step,max,theColorBegin,theColorEnd,overStep,overStep2x) {
	if(step>max) {
		if(step>=max*2) {
			if(overStep2x!=undefined) {
				return overStep2x;
			} else {
				return theColorEnd;
			}
		} else {
			if(overStep!=undefined) {
				return overStep;
			} else {
				return theColorEnd;
			}
		}
	} else if(step<=0) {
		return theColorBegin;
	} else {
		theColorBegin = parseInt(theColorBegin,16);
		theColorEnd = parseInt(theColorEnd,16);
		
		theR0 = (theColorBegin & 0xff0000) >> 16;
		theG0 = (theColorBegin & 0x00ff00) >> 8;
		theB0 = (theColorBegin & 0x0000ff) >> 0;
		theR1 = (theColorEnd & 0xff0000) >> 16;
		theG1 = (theColorEnd & 0x00ff00) >> 8;
		theB1 = (theColorEnd & 0x0000ff) >> 0;

		theR = interpolate(theR0, theR1, step, max); 
		theG = interpolate(theG0, theG1, step, max);
		theB = interpolate(theB0, theB1, step, max); 
		theVal = ((( theR << 8 ) |  theG ) << 8 ) | theB;
	    return (theVal.toString(16));
	}
}

// return the interpolated value between pBegin and pEnd
function interpolate(pBegin, pEnd, pStep, pMax) {
  if (pBegin < pEnd) {
    return ((pEnd - pBegin) * (pStep / pMax)) + pBegin;
  } else {
    return ((pBegin - pEnd) * (1 - (pStep / pMax))) + pEnd;
  }
}

//converts a hex color to RGB
function hex2rgb(hexcolor,asText=false) {
	var c = parseInt(hexcolor.replaceAll("#",""),16);
	var rgb = {
		r: (c & 0xff0000) >> 16,
		g: (c & 0x00ff00) >> 8,
		b: (c & 0x0000ff) >> 0
	}
	if(asText) {
		return rgb.r+","+rgb.g+","+rgb.b;
	} else {
		return rgb;
	}
}

//blends colors with an alpha
function blend_colors(foreground,background,alpha) {
	var r1 = parseInt(foreground.substring(0,2),16);
	var g1 = parseInt(foreground.substring(2,4),16);
	var b1 = parseInt(foreground.substring(4,6),16);
	var r2 = parseInt(background.substring(0,2),16);
	var g2 = parseInt(background.substring(2,4),16);
	var b2 = parseInt(background.substring(4,6),16);

	var r3 = Math.round(alpha * r1 + (1 - alpha) * r2);
	var g3 = Math.round(alpha * g1 + (1 - alpha) * g2);
	var b3 = Math.round(alpha * b1 + (1 - alpha) * b2);

	if(r3>255) r3=255;
	if(g3>255) g3=255;
	if(b3>255) b3=255;

	var rr3 = r3.toString(16);
	var gg3 = g3.toString(16);
	var bb3 = b3.toString(16);
	
	if(rr3.length==1) rr3="0"+rr3;
	if(gg3.length==1) gg3="0"+gg3;
	if(bb3.length==1) bb3="0"+bb3;
		
	return rr3+gg3+bb3;
}

function val2id(val) {
	return String(val).replaceAll(".","_").trim();
}

// 'improve' Math.round() to support a second argument
var _round = Math.round;
Math.round = function(number, decimals /* optional, default 0 */) {
  if (arguments.length == 1)
    return _round(number);
  var multiplier = Math.pow(10, decimals);
  return _round(number * multiplier) / multiplier;
}

function rgb(red, green, blue) {
    var decColor =0x1000000+ Math.round(blue) + 0x100 * Math.round(green) + 0x10000 *Math.round(red) ;
    return '#'+decColor.toString(16).substr(1);
}

function addCommas(nStr) {
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

function isArray(theVar) {
	if(Object.prototype.toString.call( theVar ) === '[object Array]' ) {
		return true;
	} else {
		return false;
	}
}

function inArray(needle, haystack, convert) {
    var length = haystack.length;
    for(var i = 0; i < length; i++) {
		if(convert==undefined) {
	        if(haystack[i] == needle) return true;
		} else {
			switch(convert) {
				case "string":
					if(String(haystack[i])==String(needle)) return true;
				break;
				case "float":
					if(parseFloat(haystack[i])==parseFloat(needle)) return true;
				break;
				case "int":
					if(parseInt(haystack[i])==parseInt(needle)) return true;
				break;
				default:
					if(haystack[i] == needle) return true;
				break;
			}
		} 
   }
    return false;
}

function arraysEqual(array1,array2) {
	if(!array1||!array2) return false;
	if(array1.length!=array2.length) return false;
    for (var i = 0; i < array1.length; i++) {
        // Check if we have nested arrays
        if (isArray(array1[i]) && isArray(array2[i])) {
            if(!arraysEqual(array1[i],array2[i])) return false;
        }
        else if (array1[i] != array2[i]) {
            return false;
        }
    }
    return true;
}

//geocoder wrapper
function nmgc(site,onresults,onerror) {
	this.onresults = onresults;
	this.onerror = onerror;
	this.site = site;
	this.query = (search)=> {
		var gc = this;
		$.ajax({
			type: "GET",
			method: "GET",
			dataType: "jsonp",
			url: server+"geocoder.php",
			data: {"search":search,"site":gc.site},
			success: function(data,status,jqxhr) {
				if(DEBUG) console.log("geocoder results",data)
				var status = (data.status=="success"?true:false);
				if(typeof gc.onresults == "function") gc.onresults.call(this,data);
			},
			error: function(jqxhr, status, error) {
				if(DEBUG) console.log("geocoder error",data)
				if(typeof gc.onerror == "function") gc.onerror.call(this,error);
			}
		});
	}
	return this;
}

//gets the approximate user location based on IP address
function get_location(callback) {
	if(DEBUG) console.log("get location",server+"locator.php");
	$.ajax({
		type: "GET",
		dataType: "jsonp",
		url: server+"locator.php",
		data: {"referrer":document.referrer,"uri": document.documentURI},
		success: function(data) {
			var status = (data.status=="success"?true:false);
			if(DEBUG) console.log("locator response success",data);
			if(typeof callback == "function") callback.call(this,status,data);
		},
		error: function(data) {
			if(DEBUG) console.log("locator response error",data);
			if(typeof callback == "function") callback.call(this,false,data);
		}
	});
}

//parses URL vars for permalink variables -- works for arrays, too
//permalink parameters can be in any order but if they don't have indices explicitly listed, they MUST have kt be the parameter that separates each det
//returns false if there are no URL vars.
function getUrlVars(url) {
	var vars = [];
	var hash;
	if(!url) {
		if(window.location.href.indexOf("?")<0) return false;
	  var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
 	} else {
		if(url.indexOf("?")<0 && url.indexOf("&")<0) return false;
 		var hashes = url.replaceAll("?","&").split('&');
 	}
	var last_indx;
	for(var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		if(hash[0]) {
			if((hash[0].indexOf("[")!==-1)&&(hash[0].indexOf("]")!==-1)) {
				var arr_name = hash[0].substring(0,hash[0].indexOf("["));
				var arr_indx = hash[0].substring(hash[0].indexOf("[")+1,hash[0].indexOf("]"));
				if(arr_indx=="") {
					if(arr_name=="kt") {
						if(last_indx!=undefined) {
							arr_indx = last_indx+1;
						} else {
							arr_indx = 0;
						}
					} else {
						arr_indx = last_indx;
					}
				} else {
					arr_indx = parseInt(arr_indx);
				}
				var arr = [];
				if(!vars[arr_name]) {
					//vars.push(arr_name);
					arr[arr_indx] = hash[1];
					vars[arr_name] = arr;
				} else {
					vars[arr_name][arr_indx] = hash[1];
				}
				last_indx = parseInt(arr_indx);
			} else {
				//vars.push(hash[0]);
				vars[hash[0]] = hash[1];
			}
		}
  }
  return vars;
}


function colorStep(step,max,theColorBegin,theColorEnd,overStep,overStep2x) {
	if(step>max) {
		if(step>=max*2) {
			if(overStep2x!=undefined) {
				return overStep2x;
			} else {
				return theColorEnd;
			}
		} else {
			if(overStep!=undefined) {
				return overStep;
			} else {
				return theColorEnd;
			}
		}
	} else if(step<=0) {
		return theColorBegin;
	} else {
		theColorBegin = parseInt(theColorBegin,16);
		theColorEnd = parseInt(theColorEnd,16);
		
		theR0 = (theColorBegin & 0xff0000) >> 16;
		theG0 = (theColorBegin & 0x00ff00) >> 8;
		theB0 = (theColorBegin & 0x0000ff) >> 0;
		theR1 = (theColorEnd & 0xff0000) >> 16;
		theG1 = (theColorEnd & 0x00ff00) >> 8;
		theB1 = (theColorEnd & 0x0000ff) >> 0;

		theR = interpolate(theR0, theR1, step, max); 
		theG = interpolate(theG0, theG1, step, max);
		theB = interpolate(theB0, theB1, step, max); 
		theVal = ((( theR << 8 ) |  theG ) << 8 ) | theB;
	    return (theVal.toString(16));
	}
}

// return the interpolated value between pBegin and pEnd
function interpolate(pBegin, pEnd, pStep, pMax) {
  if (pBegin < pEnd) {
    return ((pEnd - pBegin) * (pStep / pMax)) + pBegin;
  } else {
    return ((pBegin - pEnd) * (1 - (pStep / pMax))) + pEnd;
  }
}


function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

function isEmptyArray(arr) {
	if(!isArray(arr)) return false;
	if(arr.length!=1) return false;
	if(arr[0]=="") {
		return true;
	} else {
		return false;
	}
}

//verbose translation of kt depending on units
function ktOrMt(kt,shortform=false,comma=false,pluralize=false,suppress_hover=false) {
	var yield;
	var unit;
	var hover;
	if(kt>=1000) {
		yield = (kt/1000)
		unit = (shortform?"Mt":"megaton");
		hover = `1 megaton = 1 million tons of TNT equivalent (1,000 kilotons)`;
	} else if (kt<1) {
		yield =(kt*1000);
		unit = (shortform?"t":"ton");
		hover = `1 ton of TNT equivalent (1/1,000 kilotons)`;
	} else {
		yield = (kt);
		unit = (shortform?"kt":"kiloton");
		hover = `1 kiloton = 1 thousand tons of TNT equivalent`;
	}
	if(yield!==1 && pluralize==true && shortform == false) {
		unit+="s";
	}
	if(!suppress_hover) unit = `<abbr class="def_yield" title="${hover}">${unit}</abbr>`;
	if(comma) yield = addCommas(yield);
	return yield+"&nbsp;"+unit;
}

//simple linear interpolation -- returns x3 for a given y3
function lerp(x1,y1,x2,y2,y3) {
	return ((y2-y3) * x1 + (y3-y1) * x2)/(y2-y1);
}

//simple exponential interpolation with a base
function xerp(base,x1,y1,x2,y2,y3) {

		const difference = y2 - y1;
    const progress = y3 - y1;

    if (difference === 0) {
        return 0;
    } else if (base === 1) {
        return (progress / difference)*(x2-x1);
    } else {
        return ((Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1))*(x2-x1);
    }
}



var modal_end_function = "";
function query_modal(header="",contents="",buttons=[],end_function="") {
	
	$("#modal_header").toggle(header?true:false);
	$("#modal_header").html(header);
	$("#modal_text").toggle(contents?true:false);
	$("#modal_text").html(contents);
	$("#modal_buttons").toggle(buttons.length?true:false);

	var b = "";
	if(buttons.length) {
		for(var i in buttons) {
			b+="<button onclick='trigger_modal("+i+")'>"+buttons[i]+"</a> ";
		}
	}
	$("#modal_buttons").html(b);
	modal_end_function = end_function;
	$("#modals").show();
}

function trigger_modal(val) {
	if(typeof modal_end_function=="function") {
		if(modal_end_function(val)!==false) {
			$("#modals").hide();
		}
	} else {
		$("#modals").fadeOut(100);
		modal_end_function = "";
	}
}

//try to get country code of target, for stats -- easier to do on client end than later
function get_target_country(target_lat,target_lng) {
    target_country = "-1"; //change to blank -- too expensive to do this on every det. can reprocess later.
    /*
	var latlng = new google.maps.LatLng(target_lat, target_lng);
	geocoder.geocode({'latLng': latlng}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			if (results[0]) {
				$(results[0]["address_components"]).each(function(index, value) {
					if(value["types"][0]=="country") target_country = value["short_name"];
				})
			}
		} else {
			if(status==google.maps.GeocoderStatus.ZERO_RESULTS) {
				target_country = "00"; //probably ocean
			}
		}
	})*/
}

//logging function -- if the target country isn't known, will try to look it up first. otherwise is a huge pain.
function log_det(data) {
	if(data.target_lat&&data.target_lng&&!data.target_country) {
		var target_country = "-1";
		var latlng = [data.target_lat, data.target_lng];
		data.target_country = target_country;
	}
	$.ajax({
		type:"GET",
		url: server+"stats/",
		data: data,
		dataType: "jsonp",
		complete : function(response){
			if(response.responseText) console.log(response)
		}
	});
}
/*
function phys_unit(unit_val, unit_type) {
	var token = randomString();
	var output = "";
	switch(unit_type) {
		case "psi": var desc = "psi = pounds per square inch, a unit of pressure. Click to convert to kilopascals (kPa)."; break;
		case "kPa": var desc = "kPa = kilopascals, a unit of pressure. Click to convert to pounds per square inch (psi)."; break;
		case "rem": var desc = "rem = Roentgen equivalent man, a unit of equivalent radiation dose. Click to sieverts (Sv)."; break;
		case "Sv": var desc = "Sv = Sievert, a unit of equivalent radiation dose. Click to Roentgen equivalent man (rem)."; break;
		case "cal/cm&sup2;": var desc = "cal/cm^2 = calories per square centimeter, a unit of heat. Click to convert to Joules per square centimer."; break;
		case "J/cm&sup2;": var desc = "J/cm^2 = Joules per square centimeter, a unit of heat. Click to convert to calories per square centimeter."; break;	
	}
	output+="<span id='switch-unit-physical-"+token+"-label' class='switch-unit-physical-label'>"+addCommas(unit_val)+"</span>&nbsp;<a href='#' onclick=\"switchUnitsPhysical(); return false;\" class='switch-unit-physical-switcher' id='switch-unit-physical-"+token+"' baseUnit='"+unit_val+"' baseType='"+unit_type+"' unitType='"+unit_type+"' title='"+desc+"'>"+unit_type+"</a>";
	return output;
}*/
/*
function switchUnitsPhysical() {

	$(".switch-unit-switcher").each( function () {
		var baseUnit = $(this).attr("baseUnit");
		var baseType = $(this).attr("baseType");
		var unit_type = $(this).attr("unit_type");

		var val;
	
		switch(unit_type) {
			case "psi": val = Math.round(6.89475729*baseUnit,1); newUnit = "kPa"; break;
			case "kPa": val = baseUnit; newUnit = "psi"; break;
			case "rem": val = 0.01*baseUnit; newUnit = "Sv"; break;
			case "Sv": val = baseUnit; newUnit = "rem"; break;
			case "cal/cm&sup2;": val = Math.round(4.18400*baseUnit,1); newUnit = "J/cm&sup2;"; break;
			case "J/cm&sup2;": val = baseUnit; newUnit = "cal/cm&sup2;"; break;
		}

		switch(newUnit) {
			case "psi": var desc = "psi = pounds per square inch, a unit of pressure. Click to convert to kilopascals (kPa)."; break;
			case "kPa": var desc = "kPa = kilopascals, a unit of pressure. Click to convert to pounds per square inch (psi)."; break;
			case "rem": var desc = "rem = Roentgen equivalent man, a unit of equivalent radiation dose. Click to sieverts (Sv)."; break;
			case "Sv": var desc = "Sv = Sievert, a unit of equivalent radiation dose. Click to Roentgen equivalent man (rem)."; break;
			case "cal/cm&sup2;": var desc = "cal/cm^2 = calories per square centimeter, a unit of heat. Click to convert to Joules per square centimer."; break;
			case "J/cm&sup2;": var desc = "J/cm^2 = Joules per square centimeter, a unit of heat. Click to convert to calories per square centimeter."; break;	
		}
	
		var ouput ="<span id='switch-unit-physical-"+token+"-label' class='switch-unit-physical-label'>"+addCommas(unit_val)+"</span> <a href='#' onclick=\"switchUnitsPhysical(); return false;\" class='switch-unit-physical-switcher' id='switch-unit-physical-"+token+"' baseUnit='"+unit_val+"' baseType='"+unit_type+"' unitType='"+unit_type+"' title='"+desc+"'>"+unit_type+"</a>";
	
	}

}*/

//unit type constant definitions
var units = {
	MODE: {
		UNITS_SI: 0,
		UNITS_IMPERIAL: 1
	},
	TYPE: {
		UNITS_DISTANCE: 0,
		UNITS_PHYSICAL: 1 
	}
}
//unit conversion definitions
units = {...units,...{
	selected: [units.MODE.UNITS_SI,units.MODE.UNITS_IMPERIAL], //each array corresponds with a TYPE array index (e.g. distance, physical)
	types: [{ //keys correspond with TYPE
		distance: [
			{ 
				large: {
					text: "km",
					multiplier: 1,
					desc: "Click to convert distance units to imperial measurements (miles)"
				},
				small: {
					text: "m",
					multiplier: km2m,
					desc: "Click to convert distance units to imperial measurements (feet)"
				}
			},
			{ 
				large: {
					text: "mi",
					multiplier: km2mi,
					desc: "Click to convert distance units to metric system (kilometers)"
				},
				small: {
					text: "ft",
					multiplier: km2ft,
					desc: "Click to convert distance units to metric system (meters)"
				}
			},
		],
		area: [
			{
				large: {
					"text": "km&sup2;",
					multiplier: 1,
					desc: "km^2: square kilometers. Click to convert to imperial measurements (mi^2)"
				},
				small: {
					"tet": "m&sup2;",
					multiplier: sqkm2sqm,
					desc: "m^2: square meters. Click to convert to imperial measurements (ft^2)"
				}
			},
			{
				large: {
					"text": "mi&sup2;",
					multiplier: sqkm2sqmi,
					desc: "mi^2: square miles. Click to convert to metric system (km^2)"
				},
				small: {
					"text": "ft&sup2;",
					multiplier: sqkm2sqft,
					desc: "ft^2: square feet. Click to convert to metric system (m^2)"
				}
			},
		],
		speed: [
			{			
				"text": "km/hr",
				multiplier: mi2km,
				desc: "km/hr = kilometers per hour. Click to convert to miles per hour (mph). This value was converted from an original value in mph."
			},
			{
				"text": "mph",
				multiplier: 1,
				desc: "mph = mile per hour. Click to convert to kilometers per hour (km/hr)."
			}
		],
	},
	{
		pressure: [
			{
				text: "kPa",
				multiplier: 6.89476,
				desc: "kPa = kilopascals, a unit of pressure. Click to convert to pounds per square inch (psi). This unit was converted from an original value in psi."
			},
			{
				text: "psi",
				multiplier: 1,
				desc: "psi = pounds per square inch, a unit of pressure. Click to convert to kilopascals (kPa)."
			}
		],
		radiation: [
			{
				text: "Sv",
				multiplier: 1/100,
				desc: "Sv = Sieverts, a unit of equivalent radiation dose. Click to convert to Roentgen equivalent man (rem). This unit was converted from an original value in rem."
			},
			{ 
				text: "rem",
				multiplier: 1,
				desc: "rem = Roentgen equivalent man, a unit of radiation dose. Click to convert to Sieverts (Sv)."
			}
		],
		fallout: [
			{
				text: "Gy per hr",
				multiplier: 0.01,
				desc: "Gy/hr = Grays per hour, a unit of absorbed radiation dose. Click to convert to rads per hour (rad/hr)."
			},{
				text: "rads per hr",
				multiplier: 1,
				desc: "rads per hr is a unit of absorbed radiation dose. Click to convert to Grays per hour (G/hr). This unit was converted from an original value in rad/hr."
			}
		],
		heat: [
			{
				text: "J/cm&sup2;",
				multiplier: 4.18400,
				desc: "J/cm^2 = Joules per square centimeter, a unit of heat. Click to convert to calories per square centimeter (cal/cm^2)."
			},
			{
				text: "cal/cm&sup2;",
				multiplier: 1,
				desc: "cal/cm^2 = calories per square centimeter, a unit of heat. Click to convert to Joules per square centimer (J/cm^2). This unit was converted from an original value in cal/cm^2."
			}
		]
	}]
}}

/* Outputs a unit value that can be converted between imperial and SI systems. */
function unit(value,base,options={}) {
	var output = "";
	var space = typeof options.space=="undefined"?"&nbsp;":options.space;
	var u = unit_val(value,base,options);
	var unit_class = typeof options.class=="undefined"?"":" "+options.class;
	output+=`<span id="switch-unit-${u.token}-label" class="switch-unit-label${unit_class}">`;
	output+=u.text_value;
	output+=`</span>${space}`;
	output+=`<a href="#" title="${u.desc?u.desc:"Click to convert units"}" onclick="convertUnits(${u.unit_type}); return false;" class="switch-unit-switcher" `;
	output+=`id="switch-unit-${u.token}" base="${base}" value="${u.value}" unit_type="${u.unit_type}"`;
	if(typeof options.is_area !="undefined" && options.is_area==true) output+=` area="true"`;
	if(typeof options.prefer_smaller !="undefined" && options.prefer_smaller==true) output+=` prefer_smaller="true"`;
	if(typeof options.round_precision !="undefined") output+=` round_precision="${options.round_precision}"`;
	output+=`>${u.unit_abbr}`;
	output+=`</a>`;
	if(typeof options.is_area !="undefined" && options.is_area==true) output+=`&sup2;`;
	if(typeof options.show_area !="undefined" && options.show_area==true) {
		var uu = unit_val(value,base,{is_area:true})
		output+=` (<span id="switch-unit-${uu.token}-label" class="switch-unit-label">`;
		output+=uu.text_value;
		output+=`</span>${space}`;
		output+=`<a href="#" title="${uu.desc?uu.desc:"Click to convert units"}" onclick="convertUnits(${uu.unit_type}); return false;" class="switch-unit-switcher" id="switch-unit-${uu.token}" area="true" base="${base}" value="${uu.value}" unit_type="${uu.unit_type}">${uu.unit_abbr}&sup2;</a>)`;
	}
	return output;
}

//formats the raw value for the unit conversions
function unit_val(value,base,options={}) {
	switch(base) {
		case "km": 
			//note that this means it is a radius of a circle, but that we want the area
			var is_area = typeof options.is_area !="undefined"?options.is_area:false;
			var unit_type = units.TYPE.UNITS_DISTANCE;
			var unit_func = "distance";
		break;
		case "sqkm":
			//this is for areas that are precalculated and not circles
			var unit_type = units.TYPE.UNITS_DISTANCE;
			var unit_func = "area";
		break;
		case "mph":
			var unit_type = units.TYPE.UNITS_DISTANCE;
			var unit_func = "speed";
		break;
		case "psi":
			var unit_type = units.TYPE.UNITS_PHYSICAL;
			var unit_func = "pressure";
		break;
		case "rem":
			var unit_type = units.TYPE.UNITS_PHYSICAL;
			var unit_func = "radiation";
		break;
		case "cal":
			var unit_type = units.TYPE.UNITS_PHYSICAL;
			var unit_func = "heat";
		break;
		case "rhr":
			var unit_type = units.TYPE.UNITS_PHYSICAL;
			var unit_func = "fallout";
		break;
		default:
			console.log("unit: unknown base: `"+base+"`");
			return "ERROR";
		break;
	}
	var u = units.types[unit_type][unit_func][units.selected[unit_type]];
	var prefer_smaller = typeof options.prefer_smaller=="undefined"?false:options.prefer_smaller;
	if(typeof u.large != "undefined") {
		if(is_area) {
			var n_l = Math.pow(value*u.large.multiplier,2)*Math.PI;
			var n_s = Math.pow(value*u.small.multiplier,2)*Math.PI;
		} else {
			var n_l = value*u.large.multiplier;
			var n_s = value*u.small.multiplier;
		}
		if(prefer_smaller) {
			var uu = u.small;
		} else {
			var uu = u[unit_large_or_small(value,u,is_area)];
		}
	} else {
		var uu = u;
	}
	if(is_area) {
		var n = Math.pow(value*uu.multiplier,2)*Math.PI;
	} else {
		var n = value*uu.multiplier;
	}
	var desc = typeof uu.desc =="undefined"?"":uu.desc;
	if(typeof options.round_precision != "undefined") { 
		var precision = options.round_precision;
	} else {
		var precision = decimals(n);
	}
	return {text_value: addCommas(Math.round(n,precision)),unit_type:unit_type,unit_abbr:uu.text,converted_value:n,value:value,base:base,desc:desc,func:unit_func,token: randomString()	};
}


//OLD FUNCTION
//takes km and makes a formatted link for easy unit conversion.
//relies on the units global both to determine what units to display but also
//the conversion factors. assumes all raw distance units are km.
function distance(radius_km,show_area=false,is_area = false,prefer_smaller=false) {
	if(DEBUG) console.log("WARNING: deprecated function (distance) called");
	return unit(radius_km,"km",{show_area: show_area,is_area:is_area,prefer_smaller:prefer_smaller});

	var output = "";
	var token = randomString();
	var u = units.distances[units.selected_distance];
	var exp = is_area?2:1; //exponent
	if((Math.round(Math.pow(radius_km*u.large.multiplier,exp),0)==0)||prefer_smaller==true) {
		var uu = u.small;
	} else {
		var uu = u.large;
	}
	output+=`<span id="switch-unit-${token}-label" class="switch-unit-label">`;
	var n = Math.pow(radius_km*uu.multiplier,exp);	
	output+=addCommas(Math.round(n,decimals(n)));
	output+=`</span> `;
	output+=`<a href="#" title="Convert units" onclick="switchUnits(); return false;" class="switch-unit-switcher" id="switch-unit-${token}" km="${radius_km}"`;
	if(is_area) output+=` area="true"`;
	output+=`>${uu.text}`;
	output+="</a>";
	if(is_area) output+=`&sup2;`;
	if(show_area==true) {
		if((Math.round(Math.pow(radius_km*u.large.multiplier,exp)*Math.PI,2)==0)) {
			var uu = u.small;
		} else {
			var uu = u.large;
		}
		output+=` (<span id="switch-unit-${token}-label" class="switch-unit-label">`;
		var n = Math.pow(radius_km*uu.multiplier,2)*Math.PI;	
		output+=addCommas(Math.round(n,decimals(n)));
		output+=`</span> `;
		output+=`<a href="#" title="Convert units" onclick="switchUnits(); return false;" class="switch-unit-switcher" id="switch-unit-${token}" area="true" km="${Math.pow(radius_km,2)*Math.PI}">${uu.text}</a>&sup2;)`;
	}
	return output;
}

//decides whether the large or small version of a unit should be displayed 
function unit_large_or_small(value,converter,is_area=false) {
	if(is_area) {
		var n_l = Math.pow(value*converter.large.multiplier,2)*Math.PI;
		var n_s = Math.pow(value*converter.small.multiplier,2)*Math.PI;
	} else {
		var n_l = value*converter.large.multiplier;
		var n_s = value*converter.small.multiplier;
	}
	if(n_s>5000 && Math.round(n_l,2)!==0) {
		return "large";
	} else if(Math.round(n_l,0)==0) {
		return "small";
	} else {
		return "large"
	}
}

//converts any kind of unit based on clicking on it, or just running it
function convertUnits(unit_type=0,force_to=undefined) {
	if(typeof force_to=="undefined") {
		var selected = units.selected[unit_type];
		selected++;
		if(selected>units.types.length-1) selected=0;
	} else {
		var selected = force_to;
	}
	units.selected[unit_type] = selected;
	$(".switch-unit-switcher").each( function () {
		var type = $(this).attr("unit_type");
		if(+type==unit_type) {
			var base = $(this).attr("base");
			var value = $(this).attr("value");
			var area = $(this).attr("area");
			var id = $(this).attr("id");
			var prefer_smaller = $(this).attr("prefer_smaller");
			var round_precision = $(this).attr("round_precision");
			var options = {};
			if(area=="true") options.is_area = true;
			if(prefer_smaller=="true") options.prefer_smaller = true;
			if(typeof round_precision!="undefined") options.round_precision=round_precision;
			var u = unit_val(value,base,options);
			$("#"+id+"-label").html(u.text_value);
			$(this).html(u.unit_abbr+(area?"&sup2;":""));
			$(this).attr("title",u.desc?u.desc:"Click to convert units");			
		}
	})

		if(unit_type==units.TYPE.UNITS_DISTANCE) {
			updateScaleControl(units.selected[units.TYPE.UNITS_DISTANCE])
		}
	
}

//OLD FUNCTION
//converts feet to meters, miles, and kilometers automatically
//this should be set based on some kind of universal 'units' variable
//also changes the map scale for MBOX
function switchUnits(unitmode = undefined) {
	if(typeof unitmode =="undefined") { 
		units.selected_distance = (units.selected_distance==UNITS_IMPERIAL?UNITS_SI:UNITS_IMPERIAL);
	} else {
		units.selected_distance = unitmode;
	}
	convertUnits();
	return false;
	$(".switch-unit-switcher").each( function () {
		var km = $(this).attr("km");
		var area = $(this).attr("area");
		var u = units.distances[units.selected_distance];
		if(km!==undefined) {
			km = +km;
			var exp = 1;
			if(typeof area !="undefined" && area==true) exp = 2;
			if(Math.round(km*Math.pow(u.large.multiplier,exp),0)==0) {
				var uu = u.small;
			} else {
				var uu = u.large;
			}
			var n = Math.pow(km*uu.multiplier,exp);	
			var o = addCommas(Math.round(n,decimals(n)));
			$("#"+$(this).attr("id")+"-label").html(o);
			$(this).html(uu.text);
		}
	})

	if(MODE==MBOX) {
		if(units.selected_distance==UNITS_IMPERIAL) {
			mbGL.scaleControl.setUnit('imperial');
		} else {
			mbGL.scaleControl.setUnit('metric');
		}
	}
}

//tries to make sensible decisions about how many decimals we round to
function decimals(number) {
	if(number>=1000) {
		return -1;
	} else if(number>=100) {
		return 0;
	} else if(number>=10) {
		return 1;
	} else {
		return 2;
	}
}

//just generates a short random string -- useful for making little javascript tokens
function randomString() {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var string_length = 5;
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	return randomstring;
}

//simple way to display an image modally
function show_image(imagelink,imagecaption) {
	var src = $(imagelink).attr("href");

	$("body").append("<div id='modal' class='modal'></div>");
	$("#modal").append("<div id='modal_image'><img src='"+imagelink+"'>"+(typeof imagecaption=="undefined"?"":"<div id='modal_caption'>"+imagecaption+"</div>")+"</div>");

	$("#modal").on("click",function() {
		$("#modal").off("click");
		$("#modal").remove();
	})
}

//should indicate that it is high density
function isHighDensity(){
	return ((window.matchMedia && (window.matchMedia('only screen and (min-resolution: 124dpi), only screen and (min-resolution: 1.3dppx), only screen and (min-resolution: 48.8dpcm)').matches || window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 1.3), only screen and (-o-min-device-pixel-ratio: 2.6/2), only screen and (min--moz-device-pixel-ratio: 1.3), only screen and (min-device-pixel-ratio: 1.3)').matches)) || (window.devicePixelRatio && window.devicePixelRatio > 1.3));
}

function latval(pos) {
	if(typeof pos=="string" && pos.indexOf(",")>-1) return +pos.split(",")[0];
	if(Array.isArray(pos)) return +pos[0];
	if(typeof pos=="object" && pos.lat!=undefined) return +pos.lat;
	console.error("Invalid position passed to latval: "+pos);
	return false;
}
function lngval(pos) {
	if(typeof pos=="string" && pos.indexOf(",")>-1) return +pos.split(",")[1];
	if(Array.isArray(pos)) return +pos[1];
	if(typeof pos=="object" && pos.lng!=undefined) return +pos.lng;
	if(typeof pos=="object" && pos.lon!=undefined) return +pos.lon;
	console.error("Invalid position passed to lngval: "+pos);
	return false;
}


if (typeof register == 'function') { register("shared.js"); }