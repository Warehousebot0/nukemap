var windsock_marker;
var fallout_contours = [];
var fallout_points = [];
var fallout_drag_listener;
var marker_drag_listener;
var fallout_debug = false;

var old_marker_pos; 
var old_windsock_pos; 

var fallout_current;

//useful constants
var deg2rad = (Math.PI/180);
var rad2deg = (180/Math.PI);
var ft2mi = 0.000189394;
var mi2km = 1.60934;

var sqmi2sqkm = 2.58999;
var sqkm2sqmi = 0.386102;

//defaults
var rad_doses = [1,10,100,1000];
var fallout_angle_default = 225;

//used for color mixing
var background_color = "e0e0e0";

var fo = new fallout();

/* TO DO 

*/

function fallout() {

	if(fallout_debug) console.log("fallout object loaded");

	//Fallout parameters derived from Miller's Simplified Fallout Scaling System 
	this.SFSS_fallout_params = function(kt) {
		
		if((kt<1||kt>10*pow(10,5))&&!allowhuge) {
			return false;
		}

		var logW = log10(kt); //to avoid recalculation

		//alpha values (p.249-250)
		var alpha_2_3 = unlog10(-0.509+0.076*logW); 
		var alpha_4   = unlog10( 0.270+0.089*logW);
		var alpha_5   = unlog10(-0.176+0.022*logW);
		var alpha_5pr = unlog10(-0.054+0.095*logW);
		var alpha_6   = unlog10( 0.030+0.036*logW);
		var alpha_7   = unlog10( 0.043+0.141*logW);
		var alpha_8   = unlog10( 0.185+0.151*logW);
		if(kt<=28) {
		var alpha_9   = unlog10( 1.371-0.124*logW);
		} else {
		var alpha_9   = unlog10( 0.980+0.146*logW);	
		}

		//pre_reqs for X-distances (p.250)
		var a_s       = unlog10( 2.880+0.348*logW); 
		var a         = unlog10( 3.389+0.431*logW); 
		var b         = 1.40*pow(10,3)*pow(kt,0.431);
		if(kt<=28) {
		var h         = unlog10( 3.820+0.445*logW); 
		} else {
		var h         = unlog10( 4.226+0.164*logW); 
		}
		var a_R_s     = unlog10( 1.070+0.098*logW); 
		var R_s       = unlog10( 2.319+0.333*logW); 
		var a_o       = unlog10(log10(a)-(h*log10(a_R_s))/(h-R_s)); 

		var k_a       = 2.303*(log10(a_R_s)/(h-R_s));
		var z_s       = ( 2.303*(log10(a_s)-log10(a_o)))/k_a; //typo in the original!!

		if(kt>=9) {
		var z_o       = (1900+(alpha_2_3+0.020)*z_s)/alpha_2_3;
		} else {
		var z_o       = (h-b)
		}	
		
		//X-distances (p.251)
		if(kt<=28) {
		var X_1       =-unlog10( 3.308+0.496*logW); 
		var X_5       = unlog10( 3.644+0.467*logW); 
		var X_6       = unlog10( 3.850+0.481*logW); 
		var X_7       = unlog10( 3.862+0.586*logW); 
		var X_8       = unlog10( 4.005+0.596*logW); 
		var X_9       = unlog10( 5.190+0.319*logW); 
		} else {
		var X_1       =-unlog10( 3.564+0.319*logW); 
		var X_5       = unlog10( 4.049+0.186*logW); 
		var X_6       = unlog10( 4.255+0.200*logW); 
		var X_7       = unlog10( 4.268+0.305*logW);  
		var X_8       = unlog10( 4.410+0.315*logW); 
		var X_9       = unlog10( 5.202+0.311*logW); 
		}
		var Y_s       = unlog10( 3.233+0.400*logW); 
		
		//p. 250
		var X_2		  = alpha_2_3*z_s-a_s; 		
		var X_3       = alpha_2_3*z_s+a_s; 		
		var X_4       = (alpha_4*(alpha_4*z_o-1900))/(alpha_4+0.020); 

		//intensity ridges (p.251)
		if(kt<=28) {
		var k_1_2     = unlog10(-2.503-0.404*logW);
		} else {
		var k_1_2     = unlog10(-2.600-0.337*logW);
		}
		var I_2_3     = unlog10(k_1_2*(X_2-X_1)/2.303); 
	
		if(kt<=28) {
			a_h 	  = unlog10(-0.431-0.014*logW);
		} else {
			a_h 	  = unlog10(-0.837+0.267*logW);	
		}	
		var a_b_2	  = unlog10( 0.486+0.262*logW);

		var phi_5	= ((alpha_5+a_h)+Math.sqrt(a_b_2+pow(alpha_5+a_h,2)))/((alpha_5-a_h)+Math.sqrt(a_b_2+pow(alpha_5-a_h,2)));
		var phi_6   = ((alpha_6+a_h)+Math.sqrt(a_b_2+pow(alpha_6+a_h,2)))/((alpha_6-a_h)+Math.sqrt(a_b_2+pow(alpha_6-a_h,2)));
		var phi_7   = ((alpha_7+a_h)+Math.sqrt(a_b_2+pow(alpha_7+a_h,2)))/((alpha_7-a_h)+Math.sqrt(a_b_2+pow(alpha_7-a_h,2)));
		var phi_8   = ((alpha_8+a_h)+Math.sqrt(a_b_2+pow(alpha_8+a_h,2)))/((alpha_8-a_h)+Math.sqrt(a_b_2+pow(alpha_8-a_h,2)));
		var phi_9   = ((alpha_9+a_h)+Math.sqrt(a_b_2+pow(alpha_9+a_h,2)))/((alpha_9-a_h)+Math.sqrt(a_b_2+pow(alpha_9-a_h,2)));

		var phi_5pr = ((alpha_5+a_h)+Math.sqrt(a_b_2+pow(alpha_5+a_h,2)))/(alpha_2_3+Math.sqrt(a_b_2+pow(alpha_2_3,2)));
		var phi_6pr = ((alpha_6+a_h)+Math.sqrt(a_b_2+pow(alpha_6+a_h,2)))/(alpha_2_3+Math.sqrt(a_b_2+pow(alpha_2_3,2)));
		var phi_7pr = ((alpha_7+a_h)+Math.sqrt(a_b_2+pow(alpha_7+a_h,2)))/(alpha_2_3+Math.sqrt(a_b_2+pow(alpha_2_3,2)));
		var phi_8pr = ((alpha_8+a_h)+Math.sqrt(a_b_2+pow(alpha_8+a_h,2)))/(alpha_2_3+Math.sqrt(a_b_2+pow(alpha_2_3,2)));
		var phi_9pr = ((alpha_9+a_h)+Math.sqrt(a_b_2+pow(alpha_9+a_h,2)))/(alpha_2_3+Math.sqrt(a_b_2+pow(alpha_2_3,2)));

		if(kt<=28) {
		var K_5_A_alpha 	= unlog10(-3.286-0.298*logW);
		} else {
		var K_5_A_alpha 	= unlog10(-2.889-0.572*logW);	
		}
		var K_6_A_alpha 	= unlog10(-1.134-0.074*logW);
		var K_7_A_alpha 	= unlog10(-0.989-0.037*logW);
		var K_9_A_alpha 	= unlog10(-2.166-0.552*logW);

		var K_5pr_A_alpha	= unlog10(-3.185-0.406*logW);	
		var K_6pr_A_alpha	= unlog10(-1.225-0.022*logW);	
		var K_7pr_A_alpha	= unlog10(-1.079-0.020*logW);	
		var K_9pr_A_alpha	= unlog10(-2.166-0.552*logW);	
	
		var I_1 = 1; //set at 1 r/hr
		var I_4 = 1; //set at 1 r/hr
		if(alpha_5 >= a_h) {
			var I_5   = 4.606*a*K_5_A_alpha*log10(phi_5);
		} else {
			var I_5   = 4.606*a*K_5pr_A_alpha*log10(phi_5pr);
		}
		if(alpha_6 >= a_h) {
			var I_6   = 4.606*a*K_6_A_alpha*log10(phi_6);
		} else {
			var I_6   = 4.606*a*K_6pr_A_alpha*log10(phi_6pr);
		}
		if(alpha_7 >= a_h) {
			var I_7   = 4.606*a*K_7_A_alpha*log10(phi_7);
		} else {
			var I_7   = 4.606*a*K_7pr_A_alpha*log10(phi_7pr);
		}
		// there is no I_8
		if(alpha_9 >= a_h) {
			var I_9   = 4.606*a*K_9_A_alpha*log10(phi_9);
		} else {
			var I_9   = 4.606*a*K_9pr_A_alpha*log10(phi_9pr);
		}
	
		//Y_8 is from a table with interpolation for other values
		//Each index here is a log10 of a yield (0 = 1KT, 1 = 10KT, 2 = 100KT, etc.)
		var Y_8_vals = [6620,12200,48200,167000,342000,650000];
		if((logW==Math.round(logW)||kt==1000)&&(kt>=1&&kt<=100000)) { //the log10 function botches 
			var Y_8 = Y_8_vals[Math.round(logW)];		
		} else {
			if(kt<1) { //dubious interpolation
				var Y_8 = 6620/((logW-log10(6620))*-2);
			} else if(kt<=100000) {
				var Y_8_1 = Y_8_vals[Math.floor(logW)];
				var Y_8_2 = Y_8_vals[Math.ceil(logW)];
				var Y_8 = Y_8_1 + (Y_8_2-Y_8_1) * (unlog10(logW)/unlog10(Math.ceil(logW)));
			} else if(kt>100000) { //dubious interpolation
				var Y_8 = 650000*((logW-log10(650000))*2);
			}
		}
		//alternative method that just curve fits
		//var Y_8 = Math.exp(((((9.968481E-4)*Math.log(kt)-.027025999)*Math.log(kt)+.22433052)*Math.log(kt)-.12350012)*Math.log(kt)+8.7992249);
	
		return {
				x1:X_1,
				x2:X_2,
				x3:X_3,
				x4:X_4,
				x5:X_5,
				x6:X_6,
				x7:X_7,
				x8:X_8,
				x9:X_9,
				ys:Y_s,
				y8:Y_8,
				i1:I_1,
				i2:I_2_3,
				i3:I_2_3,
				i4:I_4,
				i5:I_5,
				i6:I_6,
				i7:I_7,
				i9:I_9,
				zo:z_o
		};	
	}

	//returns in miles -- one might wonder why we separate this from the points function. It is so you can access this data (say, for the legend) without complete recalculation of all of the information.
	
	//rad_doses is an array of radiation doses in rads/hr to computer
	
	//fission fraction is a number less than or equal to 1 (100%) and greater than zero
	this.SFSS_fallout = function(kt,rad_doses,fission_fraction,windspeed) {

		var x_var = 0;
		var y_var = 1;
		var i_var = 2;
		var p = this.SFSS_fallout_params(kt);

		if(!fission_fraction) fission_fraction = 1;

		if(fallout_debug) console.log(p);
	
		var dose_data = [];
				
		for(var i=0;i<rad_doses.length;i++) {
			var rad = rad_doses[i] * (1/fission_fraction); //fission fraction decreases the overall radiation linearly.
			
			//create the dose_data object -- all input distances in feet, all output in miles
			var d = {
				
				r: rad_doses[i],

				r_: rad, 

				ff: fission_fraction,
				
				draw_stem: 
					rad<=p.i2?true:false //quick test to see if we are above the stem threshhold anyway
				,
				
				draw_cloud:
					rad<=p.i7?true:false //ditto for cloud -- numbers above these values produce nonsense results
				,
																
				max_cloud_rad: 
					p.i7 / (1/fission_fraction) //this allows us to report what the maximum mappable radiation level is for this yield -- note we take into account fission fraction here
				,

				max_stem_rad:
					p.i2 / (1/fission_fraction) //ditto
				,
			
				x_center: p.x2*ft2mi,

				upwind_stem_distance: ((
					log_lerp(p.x1,p.i1,p.x2,p.i2,rad)
				)*ft2mi),

				downwind_stem_distance: (( 
					log_lerp(p.x3,p.i3,p.x4,p.i4,rad)
				)*ft2mi),
				
				max_stem_width: ((
					log_lerp(0,p.i2,p.ys,1,rad) 
				)*ft2mi),

				upwind_cloud_distance: ((
					rad>p.i6 ?
					log_lerp(p.x6,p.i6,p.x7,p.i7,rad):
					log_lerp(p.x5,p.i5,p.x6,p.i6,rad)
				)*ft2mi),

				downwind_cloud_distance: ((
					log_lerp(p.x7,p.i7,p.x9,p.i9,rad)
				)*ft2mi),
			
				max_cloud_width: ((
					(
					(p.y8*log10(p.i7/rad))
					/
					(log10(p.i7/p.i9))
					)
					//*.8 //correction to match drawings, but values are correct
				)*ft2mi),
								
				cloud_widen_point: ((
					p.x7+(p.x8-p.x7)*(
					(
					(p.y8*log10(p.i7/rad))
					/
					(log10(p.i7/p.i9))
					)	
					 /p.y8)
				)*ft2mi)
			};

			//adjust for wind speed, uses Glasstone 1977's relation to change downwind values
			if(windspeed>15) {
				var wm = (1+((windspeed-15)/60));		
			} else if(windspeed<15) {
				var wm = (1+((windspeed-15)/30));
			}
			if(wm) {
				d.downwind_cloud_distance*=wm;
				d.downwind_stem_distance*=wm;
			}

			//estimate of the area enclosed -- sq mi
			if(d.draw_stem) {
				d.stem_area = (
					//stem - ellipse estimate -- this is OK
					(
					Math.PI * ((d.downwind_stem_distance-d.upwind_stem_distance)/2) * (d.x_center-d.upwind_stem_distance) 
					)
					);
			} else {
				d.stem_area = 0;
			}
			if(d.draw_cloud) {			
				d.cloud_area = (
					//cloud ellipse 1			
					(				
					Math.PI * (d.downwind_cloud_distance) * (d.max_cloud_width) 
					) /2
	
					//cloud ellipse 2
					+				
					(				
					Math.PI * d.downwind_cloud_distance-((d.cloud_widen_point)/2-(d.upwind_cloud_distance)/2) * (d.max_cloud_width) 		
					) /2
				);
			} else {
				d.cloud_area = 0;
			}
								
			dose_data[rad_doses[i]] = d;
		}	

		if(fallout_debug) console.log(dose_data);
		return dose_data;
	}
	
	//f is a single dose_data object returned by the above function
	this.SFSS_fallout_points = function(f,angle,steps) {
		var p = [];
						
		if(fallout_debug) console.log(f);

		var stem_circle_radius = (f.x_center-f.upwind_stem_distance);
		var stem_inner_x = Math.sin(80*deg2rad)*stem_circle_radius;

		if(f.draw_stem) {
			//stem top		
			draw_arc(p,	f.upwind_stem_distance,0,	f.x_center,stem_circle_radius,	steps/2);
			draw_arc(p,	f.x_center,stem_circle_radius,	stem_inner_x, f.max_stem_width, steps/2);		

			//test if the stem and the cloud join
			if(((f.upwind_cloud_distance+f.x_center)<f.downwind_stem_distance)&&f.draw_cloud) {
				var pp = [];
				draw_arc(pp, f.upwind_cloud_distance+f.x_center,0, f.cloud_widen_point+f.x_center, f.max_cloud_width,steps);
				pp = trim_points(pp,1,f.max_stem_width,"<");
				add_points(p,pp);
			} else {
				p.push([f.downwind_stem_distance*.8,f.max_stem_width]);
				p.push([f.downwind_stem_distance,0]);
				if(f.draw_cloud) draw_arc(p, f.upwind_cloud_distance+f.x_center,0, f.cloud_widen_point+f.x_center, f.max_cloud_width,steps);
			}
		} else {
			if(f.draw_cloud) draw_arc(p, f.upwind_cloud_distance+f.x_center,0, f.cloud_widen_point+f.x_center, f.max_cloud_width,steps);
		}

		if(f.draw_cloud) {
			//cloud
			draw_arc(p, f.cloud_widen_point+f.x_center, f.max_cloud_width,	f.downwind_cloud_distance-f.x_center*2, 0, steps);
			draw_arc(p,	f.downwind_cloud_distance-f.x_center*2, 0, f.cloud_widen_point+f.x_center, -f.max_cloud_width, steps);
		}

		if(f.draw_stem) {
			//stem bottom
			if(((f.upwind_cloud_distance+f.x_center)<f.downwind_stem_distance)&&f.draw_cloud) {
				var pp = [];
				draw_arc(pp, f.cloud_widen_point+f.x_center, -f.max_cloud_width, f.upwind_cloud_distance+f.x_center,0, steps);	
				pp = trim_points(pp,1,-f.max_stem_width,">");
				add_points(p,pp);
			} else {
				if(f.draw_cloud) draw_arc(p, f.cloud_widen_point+f.x_center, -f.max_cloud_width, f.upwind_cloud_distance+f.x_center,0, steps);
				p.push([f.downwind_stem_distance,0]);				
				p.push([f.downwind_stem_distance*.8,-f.max_stem_width]);
			}
			draw_arc(p,	stem_inner_x, -f.max_stem_width, f.x_center,-stem_circle_radius, steps/2);
			draw_arc(p,	f.x_center,-stem_circle_radius,	f.upwind_stem_distance,0, steps/2);
		} else {
			if(f.draw_cloud) draw_arc(p, f.cloud_widen_point+f.x_center, -f.max_cloud_width, f.upwind_cloud_distance+f.x_center,0, steps);		
		}
				
		p = rotate_points(p,angle);
		
		return p;

	}

	//draws a partial arc joining points x1,y1 and x2,y2 centered at xc,yc
	function draw_arc(p,x1,y1,x2,y2,steps) {
		if(x1<x2) {
			if(y1<y2) {
				//top left
				var xc = x2;
				var yc = y1;
			} else {
				//top right
				var xc = x1;
				var yc = y2;
			}
		} else {
			if(y1<y2) {
				//bottom left
				var xc = x1;
				var yc = y2;
			} else {
				//bottom right				
				var xc = x2;
				var yc = y1;				
			}
		}
		
		var e_width = Math.abs(xc==x1?xc-x2:xc-x1);
		var e_height = Math.abs(yc==y1?yc-y2:yc-y1);
		
		var start_angle = Math.atan2(y1-yc,x1-xc);
		var stop_angle = Math.atan2(y2-yc,x2-xc);

		if(start_angle<0) start_angle+=Math.PI*2;

		var step = (stop_angle-start_angle)/steps;
	
		if(step<0) {			
			for(var theta=start_angle; theta > stop_angle; theta+=step) { 
				var x = xc + e_width*Math.cos(theta);
				var y = yc + e_height*Math.sin(theta);    
				p.push([x,y]);
			}
		} else {
			for(var theta=start_angle; theta < stop_angle; theta+=step) { 
				var x = xc + e_width*Math.cos(theta);
				var y = yc + e_height*Math.sin(theta);    
				p.push([x,y]);
			}
		}
		p.push([x2,y2]);		
	}
	
	//trims points based on criteria
	//input is an array of points (p), a lat/lng flag (0 = lat, 1 = lng), a value to compare to (compare), and a comparison mode (string)
	function trim_points(p,latlng,compare,mode) {
		var pp = [];
		for(var i = 0; i<p.length;i++) {
			var bad = false;
			switch(mode) {
				case "<" : var bad = p[i][latlng]<compare; break;
				case "<=": var bad = p[i][latlng]<=compare; break;
				case ">" : var bad = p[i][latlng]>compare; break;
				case ">=": var bad = p[i][latlng]>=compare; break;
				case "==": var bad = p[i][latlng]==compare; break;
				case "!=": var bad = p[i][latlng]!=compare; break;
			}
			if(!bad) pp.push(p[i]);
		}
		return pp;
	}

	//adds points arrays from pp to p
	function add_points(p,pp) {
		for(var i=0; i<pp.length;i++) {
			p.push(pp[i]);
		}
	}
}

//creates the fallout polygon from points and adds it to the map
function plot_fallout(gz, points,color,legend) {
	var R = 6371; //Earth's mean radius in km
	var coords = [];
	if(color.substring(0,1)!="#") color="#"+color;

	var gzlat = latval(gz);
	var gzlng = lngval(gz);

	var coords = points_to_ll(gzlat,gzlng,points);
	coords.forEach(function(p,i){ coords[i] = {lat:p[0],lon:p[1]}});
	
	if(!fallout_contours[det_index]) fallout_contours[det_index] = [];
	if(fallout_contours[det_index]) {
		var zoff = fallout_contours[det_index].length+1;
	} else {
		var zoff = 1;
	}
	var poly = MAPUI.polygon({
		latLons: coords,
		stroke: false,
		fillColor: color,
		fillOpacity: 0.25,
		map: map,
		visible: true,
		beforeLayer: "falloutLayer",
		pane: "fallout",
		zindex: -10*(-det_index+1)+zoff,
	});
	fallout_contours[det_index].push(poly)
}

//main fallout function
function do_fallout(kt, wind, fission_fraction, angle, fallout_info_div_id, airburst,hob_ft) {
		if(fallout_debug) console.log("do_fallout");
		if(DEBUG) console.log("do_fallout");

		if(typeof fallout_contours[det_index] !="undefined") clear_fallout(); 

		if(((kt<1)||(kt>10*pow(10,5)))&&!allowhuge) {
			if(typeof fallout_info_div_id!=="undefined") {
				if($("#"+fallout_info_div_id).length>0) {
					$("#"+fallout_info_div_id).html("<hr><b>The fallout model only works for yields between 1 and 100,000 kilotons.</b>");
				}
			}
			return false;
		}
		
		if(!windsock_marker) { //create the wind marker
			new_windsock(angle);
		} else if(angle) {
			var m_pos = marker.getLatLon();
			var m_lat = latval(m_pos);
			var m_lng = lngval(m_pos);
			var w_pos = windsock_marker.getLatLon();
			var w_lat = latval(w_pos);
			var w_lng = lngval(w_pos);
			
			windsock_distance = distance_between(m_lat,m_lng,w_lat,w_lng);
			var wpos = destination_from_bearing(m_lat,m_lng,parseInt(angle)+180,windsock_distance);
			windsock_marker.setLatLon(wpos);
		}
		if(!angle) angle = fallout_bearing(marker.getLatLon(),windsock_marker.getLatLon());
		if(!angle) angle = 0;
		

		if(hob_ft) {
			var kt_frac = fallout_kt_hob(kt,fission_fraction,hob_ft);		
		} else {
			var kt_frac = 0;
		}

		fallout_current = {
			kt: kt,
			wind: wind,
			fission_fraction: fission_fraction,
			fallout_info_div_id: fallout_info_div_id,
			rad_doses: rad_doses,
			angle: angle,
			airburst: airburst,
			hob_ft: hob_ft,
			kt_frac: kt_frac,
		}
		draw_fallout();
	
}

//draws fallout using the current settings. we keep these separate from the other function so I can just call it whenever I want to refresh it.
//it would be better to make a refresh fallout function that didn't recreate everything from scratch, just re-projected the coordinates.
//is that possible? would need to store the original coordinate points.
function draw_fallout() {
	if(DEBUG) console.log("draw_fallout");
	if(fallout_debug) console.log('draw_fallout');
	if(fallout_current) {	
		if(typeof fallout_contours[det_index] !="undefined") clear_fallout();
		
		if(fallout_current.fallout_info_div_id) {
			var fallout_info = $("#"+fallout_current.fallout_info_div_id);
		}
	
		if(fallout_current.airburst&&fallout_current.kt_frac==0) {

			if($(fallout_info).length>0) {
				var o= ""
				o+="<hr>";
				o+="<p><b>Fallout:</b> Your choice of burst height is too high to produce significant local fallout. The minimum burst height to produce appreciable fallout for a yield of "+ktOrMt(fallout_current.kt)+" is "+unit(180*Math.pow(fallout_current.kt,.4)*ft2km,"km")+".";
				$(fallout_info).html(o);
			}
		} else {
		
			if(windsock_marker) {
				var marker_pos = marker.getLatLon();
				var windsock_pos = windsock_marker.getLatLon();

				var m_lat = latval(marker_pos);
				var m_lng = lngval(marker_pos);
				var w_lat = latval(windsock_pos);
				var w_lng = lngval(windsock_pos);

				windsock_distance = distance_between(m_lat,m_lng,w_lat,w_lng);
				var wpos = destination_from_bearing(m_lat,m_lng,parseInt(fallout_current.angle)+180,windsock_distance);
				//this cuts down on unnecessary moves/redraws
				if((Math.round(latval(wpos),1)!=Math.round(latval(windsock_pos),1))||
				   (Math.round(lngval(wpos),1)!=Math.round(lngval(windsock_pos),1))) {
					windsock_marker.setLatLon(wpos);
				}
			}
			var pos = marker.getLatLon();

			if(fallout_current.kt_frac&&fallout_current.airburst) {
				var sfss = fo.SFSS_fallout(fallout_current.kt_frac,fallout_current.rad_doses,(fallout_current.fission_fraction/100),fallout_current.wind);
			} else {
				var sfss = fo.SFSS_fallout(fallout_current.kt,fallout_current.rad_doses,(fallout_current.fission_fraction/100),fallout_current.wind);
			}
		
			if(fallout_info) {
				var o = "";
				o+="<hr><div>";
				o+= "Estimated <b>fallout radiation intensity contours</b> for a "+ktOrMt(fallout_current.kt);
				if(fallout_current.airburst&&fallout_current.kt_frac) {
					o+=" airburst*";
				} else {
					o+=" surface burst";
				}
				if(fallout_current.fission_fraction<100) {
					o+=" ("+(fallout_current.fission_fraction>1?Math.round(fallout_current.fission_fraction):fallout_current.fission_fraction)+"% fission)";
				}
				o+=" with a "+unit(fallout_current.wind,"mph",{round_precision:0})+" wind at one hour after detonation: ";

				o+= "<span class='hider-arrow expanded' expanded='1' div='effects_captions_fallout' onclick='expand_div(this);'>&nbsp;</span>"
				o+= "<div class='collapsed-content' id='effects_captions_fallout'>";

			}
		
			if(fallout_debug) console.log(sfss);
		
			var steps = 15;

			dets[det_index].fallout_angle = Math.round(fallout_current.angle);
			dets[det_index].fallout_rad_doses = fallout_current.rad_doses;
		
			fallout_points[det_index] = [];
			for(var i = 0; i<fallout_current.rad_doses.length; i++) {
				var f_color = colorStep(log10(rad_doses[i]),log10(1000),"FFFF00","FF0000","010000","010000");
	
				var ss = sfss[fallout_current.rad_doses[i]];

				//render the points at 0 angle first -- for whatever reason that seems to need to be -90
				var points = fo.SFSS_fallout_points(ss,-90,steps);
				//save them
				fallout_points[det_index].push(points);
				//then rotate them
				plot_fallout(pos,rotate_points(points,fallout_current.angle),f_color,fallout_current.rad_doses[i]+" r/hr");

				if(fallout_info) {
					o+=`<div class="effectCaption" index="${det_index}" fallout_contour="${i}">`;
					o+=`<div class="effectCaptionHeader">`;
					o+="<div class='legendkey falloutlegendkey' style='background-color: #"+blend_colors(blend_colors("000000",background_color,.25),f_color,.25)+"; border: 1px solid #ff5d2e;'></div> Fallout contour for "+unit(fallout_current.rad_doses[i],"rhr",{class:"bold"})+": ";
					o+="</div>";
					o+= "<ul>";
				
					if(ss.draw_cloud||ss.draw_stem) {
						if(!ss.draw_cloud&&ss.draw_stem) {
							o+= "<li>Maximum downwind fallout (stem only) distance: "+unit(ss.downwind_stem_distance*mi2km,"km");
							o+= "<li>Maximum stem width: "+unit(ss.max_stem_width*2*mi2km,"km");
							o+= "<li>Approximate area affected: "+unit(ss.stem_area*sqmi2sqkm,"sqkm");
							o+= "<li>For a detonation of this yield, this radiation level ("+unit(fallout_current.rad_doses[i],"rhr")+") is too high for <em>cloud</em> fallout, and so this contour is not mapped (but <em>stem</em> fallout is). The maximum radiation contour for cloud fallout that can be mapped for this yield is ~"+unit(ss.max_cloud_rad,"rhr")+".";
						} else if (ss.draw_cloud&&!ss.draw_stem) {
							o+= "<li>Maximum downwind fallout distance: "+unit(ss.downwind_cloud_distance*mi2km,"km");
							o+= "<li>Maximum width: "+unit(ss.max_cloud_width*2*mi2km,"km");
							o+= "<li>Approximate area affected: "+unit(ss.stem_area+ss.cloud_area*sqmi2sqkm,"sqkm");
							o+= "<li>For a detonation of this yield, this radiation level ("+unit(fallout_current.rad_doses[i],"rhr")+") is too high for <em>stem</em> fallout, and so this contour is not mapped (but <em>cloud</em> fallout is). The maximum radiation contour for stem fallout that can be mapped for this yield is ~"+unit(ss.max_stem_rad,"rhr")+".";
						} else {
							o+= "<li>Maximum downwind fallout distance: "+unit(ss.downwind_cloud_distance*mi2km,"km");
							o+= "<li>Maximum width: "+unit(ss.max_cloud_width*2*mi2km,"km");
							o+= "<li>Approximate area affected: "+unit(ss.stem_area+ss.cloud_area*sqmi2sqkm,"sqkm");
						}
					} else {
						o+= "<li>For a detonation of this yield, this radiation level ("+unit(fallout_current.rad_doses[i],"rhr")+") is too high for fallout, and so this contour is not mapped. The maximum radiation contour for cloud fallout that can be mapped for this yield is ~"+unit(ss.max_cloud_rad,"rhr")+"; for stem fallout it is ~"+unit(ss.max_stem_rad,"rhr")+".";		
					}	
					o+= "</ul>";
				}
				o+="</div>";
			}	
		
			if(fallout_info) {		
				if(det_index>0) {
					var fallouts = 0;
					for(var i=0;i<=det_index;i++) {
						if(fallout_contours[i]) {
							if(fallout_contours[i].length) fallouts++;
						}
					}
					if(fallouts>1) o+="<small>You have multiple fallout contours plotted. The above information is valid only for the active contour.</small><br>";
				}
				if(fallout_current.kt_frac&&fallout_current.airburst) {
					o+="<small>*At a burst height of "+unit(fallout_current.hob_ft*ft2km,"km")+", the fallout is equivalent to a "+ktOrMt(Math.round(fallout_current.kt_frac))+" surface burst with the same fission fraction.</small><br>";
				}

				var marker_pos = marker.getLatLon();
				var windsock_pos = windsock_marker.getLatLon();

				var m_lat = latval(marker_pos);
				var m_lng = lngval(marker_pos);
				var w_lat = latval(windsock_pos);
				var w_lng = lngval(windsock_pos);
				
				if(windsock_marker) {
					o+= "<small id='fallout_windsock'>The fallout windsock is "+unit(distance_between(m_lat,m_lng,w_lat,w_lng), "km")+" from ground zero. <a href='#' onclick='hide_windsock(); return false;' id='hide_windsock'>Click here to hide the windsock.</a></small><br>";
				} else {
					o+= "<small id='fallout_windsock'><a href='#' onclick='hide_windsock(); return false;' id='hide_windsock'>Click here to show the windsock.</a></small><br>";			
				}
				o+="<small>To change the radiation doses to map, <a href='#' onclick='change_doses();return false;'>click here</a>.</small><br>";
				o+="<hr>";
				o+="<small>Fallout intensity contours show what the fallout radiation intensity in the affected area one hour after detonation. For some distances, the fallout may not have arrived by that time. To see what this means in terms of human health at a given point on the map, and the effect of possible shelters, use the \"Inspect location\" tool. ";
				o+="Fallout contamination moves with the wind, and this model uses a highly-simplified version of atmospheric conditions. Any real-life scenario would be much more complicated. "
				o+="For more information on the fallout model and its interpretation, <a href=\"faq\#fallout\" target=\"_blank\">click here</a>.</small><br>";
				o+="</div></div>";
				$(fallout_info).html(o);			
			}

			old_marker_pos = pos;
		}
	}
}

//re-renders the fallout polygons of the current detonation
//for most modes this means just redrawing them entirely
function redraw_fallout() {
	if(typeof fallout_current == "undefined") return false;
	if(DEBUG) console.log("redraw_fallout");
	for(var i in fallout_points[det_index]) {
		var points = fallout_points[det_index][i];
		var marker_pos = marker.getLatLon();
		var coords = points_to_ll(latval(marker_pos),lngval(marker_pos),rotate_points(points,fallout_current.angle));
		dets[det_index].fallout_angle = Math.round(fallout_current.angle);
		dets[det_index].fallout_rad_doses = fallout_current.rad_doses;
		/*coords.forEach(function(p,i) { coords[i] = [p[0],p[1]] });
		fallout_contours[det_index][i].coordinates = [coords];
		fallout_contours[det_index][i].redraw();*/
		fallout_contours[det_index][i].setLatLons(coords);
	}
}
//toggles the windsock marker on or off
var old_windsock_pos;
function hide_windsock() {
	if(windsock_marker) {
		old_windsock_pos = windsock_marker.getLatLon();
		windsock_marker = windsock_marker.remove();
		$('#hide_windsock').html("Click here to show the windsock.");
	} else {
		new_windsock(undefined,old_windsock_pos);
		$('#hide_windsock').html("Click here to hide the windsock.");
	}
}

//this scales the fission yield according to height of burst. Input is kt, fission_fraction (0-1), height of burst (feet)
//returns a new kilotonnage, or 0 if the hob is too high for local fallout
//taken from eq. 4.4.1 of H.G. Norment, "DELFIC: Department of Defense Fallout Prediction System, Vol. I-Fundamentals" (DNA 5159F-1, 31 December 1979), page 53. 
function fallout_kt_hob(kt,fission_fraction,hob) {
	if(hob==0) return kt; //surface burst, no doubt
	var fission_kt = kt*(fission_fraction/100);
	var scaled_hob_activity_decay_constant = hob/Math.pow(kt,(1/3));
	var scaled_hob = hob/Math.pow(kt,(1/3.4));
	var max_hob = 180*Math.pow(kt,.4); //Glasstone and Dolan, 1977 edn., p.71
	if(hob>=max_hob) { //using Glasstone' def of negligible fallout rather than DELFICs, because DELFICs seems about 40-50% lower for no reason
		return 0;
	} else 
	if (scaled_hob_activity_decay_constant<=0) {
		return 0;
	} else {
		var f_d = Math.pow(0.45345,scaled_hob_activity_decay_constant/65);
		var scaled_kt = (fission_kt*f_d)/(fission_fraction/100);
		return scaled_kt;
	}
}

//creates a new windsock
function new_windsock(angle,position = undefined) {
	if(DEBUG) console.log("new_windsock");
	if(windsock_marker) {
		windsock_marker = windsock_marker.remove();
	}
	if(typeof position=="undefined") {

		var pos = marker.getLatLon();
		var m_lat = latval(pos);
		var m_lng = lngval(pos);
			
		if(!angle&angle!==0) {
			if($("#fallout_angle").val()) {
				angle = $("#fallout_angle").val();
			} else {
				angle = fallout_angle_default; //default angle
			}
		}
		var z = MAPUI.map.getZoom();
	//	if(z>12) z = 12; //close zooms confuse it for some reason
		windsock_distance = (16-z)*2-1;
		var ang = (+angle)+180;
		while(ang>=360) { ang-=360; }
		var wpos = destination_from_bearing(m_lat,m_lng,ang,windsock_distance);
		wpos = {lat:wpos[0],lon:wpos[1]};	
	} else {
		var wpos = position;
	}
	/*
	var m = MAPUI.marker({
		id:"test",
		position: wpos
	})*/
		
	windsock_marker = MAPUI.marker({
		map: MAPUI.map,
		id: "windsock",
		className: "windsock",
		position: wpos,
		draggable: true,
		title: "Drag to change wind direction for fallout",
		animation: "drop",
		icon: {
			id: "windsock",
			iconUrl: MAPUI.mm.images.windsockIcon,
			iconSize: [34*marker_scale, 36*marker_scale], 
			iconAnchor: [9*marker_scale,22*marker_scale],
			mousedown: {
				offset: -8*marker_scale,
				className: "windsockUp"
			}
		},
		shadow: {
			className: "windsockShadow",
			id: "windsockShadow",
			iconUrl: MAPUI.mm.images.windsockShadowIcon,
			iconSize: [28*marker_scale,19*marker_scale],
			iconAnchor: [0,0],
			mousedown: {
				className: "windsockShadowUp"
			}
		}
	})
	var new_angle = fallout_bearing(marker.getLatLon(),windsock_marker.getLatLon());
	if(new_angle<0) new_angle+=360;
	windsock_marker.shadow.css("rotate",(new_angle+90)+"deg");
	windsock_marker.eventOn("dragend",function() {
		console.log("windsock_marker","dragend");
		var new_angle = fallout_bearing(marker.getLatLon(),windsock_marker.getLatLon());
		if(new_angle<0) new_angle+=360;
		$("#fallout_angle").val(new_angle);
		if(fallout_current.angle!=new_angle) { //this cuts down on a LOT of unnecessary redraws
			fallout_current.angle = new_angle;
			redraw_fallout();
		}
		if($("#fallout_windsock")>0) {
			var m_pos = marker.getLatLon();
			var w_pos = windsock_marker.getLatLon();
			$("#fallout_windsock").html("Fallout windsock is "+unit(distance_between(latval(m_pos),marker.lngval(m_pos),latval(w_pos),lngval(w_pos)),"km")+" from ground zero. <a href='#' onclick='hide_windsock(); return false;' id='hide_windsock'>Click here to hide windsock.</a>");
		}
		update_permalink();
	});
	windsock_marker.eventOn("drag",function() {
		//I think only the MapboxGL is probably fast enough to do this on most machines.
		//Even then, should check that this is true. 
		//LLET seems fine on mine as well -- but there might be problems on any machine that can't run GL.
		var new_angle = fallout_bearing(marker.getLatLon(),windsock_marker.getLatLon());
		if(new_angle<0) new_angle+=360;
		windsock_marker.shadow.css("rotate",(new_angle+90)+"deg");

		//$(windsock_marker.shadow.getIcon()).css("rotate",(new_angle+90)+"deg");
		if(MAPUI.webGLsupported) {
			$("#fallout_angle").val(new_angle);
			if(fallout_current.angle!=new_angle) { //this cuts down on a LOT of unnecessary redraws
				fallout_current.angle = new_angle;
				redraw_fallout();
			}
		}
	})
}

//moves the windsock to match its relative position with the ground zero marker
function move_windsock() {
	if(old_marker_pos&&windsock_marker) {
		var m_pos = marker.getLatLon();
		var dlat = latval(m_pos)-latval(old_marker_pos);
		var dlng = lngval(m_pos)-lngval(old_marker_pos);
		var w_pos = windsock_marker.getLatLon();
		windsock_marker.setLatLon({lat:latval(w_pos)+dlat,lon:lngval(w_pos)+dlng});
		windsock_marker.eventTrigger(["drag"]); //should cause the shadow to move
		old_marker_pos = m_pos;
	} 
}

//changes which doses are displayed
function change_doses() {
	var current = '';
	for(var i=0; i<rad_doses.length;i++) {
		current+=''+rad_doses[i];
		if(i<rad_doses.length-1) current+=",";
	}
	var input_doses = window.prompt("To change the doses plotted in the fallout curves, enter them in below as numbers separated by commas. These numbers are in rads/hour, between 1 and 30,000. Invalid numbers will be ignored.",current);

	if(input_doses) {
		var new_doses = [];
		var input_doses_array = input_doses.split(",");
		for(var i=0; i<input_doses_array.length;i++) {
			var n = parseInt(input_doses_array[i]);
			if(((n>0)&&(n<=30000))||allowhuge) {
				new_doses.push(n);
			}
		}
		if(new_doses.length>0) {
			rad_doses = new_doses;
			rad_doses.sort(function(a,b){return a-b});
			if(fallout_current) {
				fallout_current.rad_doses = rad_doses;
				draw_fallout();
			}
		}
	}
	dets[det_index].rad_doses = fallout_current.rad_doses;
	update_permalink();
}

//rotates an array of points to a certain angle
//note that this now returns a new array. previously it was
//modifying the underlying points_array which was creating problems.
function rotate_points(points_array,angle_degrees) {
	var rotated = []; 
	//normalize angle for wind
	angle_degrees=(90-angle_degrees)+180; 
	//rotate
	var angle_rad = (angle_degrees) * deg2rad;
	var sinA = Math.sin(angle_rad);
	var cosA = Math.cos(angle_rad);
	for(var i=0;i<points_array.length;i++) {
		var px = points_array[i][0];
		var py = points_array[i][1];
		rotated[i] = [px * cosA - py * sinA, px * sinA + py * cosA];
	}
	return rotated;
}

//gets the bearing between two points
function fallout_bearing(pos1,pos2) {
	p1lat = latval(pos1);
	p2lat = latval(pos2);
	p1lng = lngval(pos1);
	p2lng = lngval(pos2);
	brng = get_bearing(p1lat,p1lng,p2lat,p2lng);
	brng+=180;
	brng = normalize_bearing(brng);
	return Math.round(brng);
}


//clears fallout contours
function clear_fallout() {
	if(DEBUG) console.log("clear_fallout");
	if(fallout_contours[det_index]) {
		if(fallout_contours[det_index].length) {
			for(var i=0; i<fallout_contours[det_index].length;i++) {
				fallout_contours[det_index][i].remove();
			}
			fallout_contours[det_index]=undefined;
		}
	}
}



//determine fallout exposure at a point
//returns in rad/hr at H+1
function h1_dose_at_point(sample_lat,sample_lon,gz_lat,gz_lon) {
	if(!fallout_current) {
		console.log("No fallout object");
		return false;
	}
		
	var dist = distance_between(gz_lat,gz_lon,sample_lat,sample_lon)*km2mi;
	var abs_bearing = get_bearing(gz_lat,gz_lon,sample_lat,sample_lon);
	var rel_bearing = Math.abs(normalize_bearing(fallout_current.angle-180)-abs_bearing);
	var dw_dist = (Math.cos(rel_bearing*deg2rad)*dist)*km2mi;//downwind distance along centerline (x axis) -- note negative is upwind
	var cw_dist = Math.abs(Math.sin(rel_bearing*deg2rad)*dist)*km2mi; //crosswind distance perpendicular to centerline (y axis) -- note this is absolute
	
	if(fallout_current.hob_ft) {
		fallout_current.kt_frac = fallout_kt_hob(fallout_current.kt,fallout_current.fission_fraction,fallout_current.hob_ft);		
	} else {
		fallout_current.kt_frac = 0;
	}
	
	//too high
	if(fallout_current.airburst&&fallout_current.kt_frac==0) {
		return 0;
	}

	//first get 1 rad info
	var steps = 15;

	if(fallout_current.kt_frac&&fallout_current.airburst) {
		var sfss = fo.SFSS_fallout(fallout_current.kt_frac,[1],(fallout_current.fission_fraction/100),fallout_current.wind);
	} else {
		var sfss = fo.SFSS_fallout(fallout_current.kt,[1],(fallout_current.fission_fraction/100),fallout_current.wind);
	}	

	//quick check for 1 rad
	if(!point_in_poly([sample_lat,sample_lon],points_to_ll(gz_lat,gz_lon,fo.SFSS_fallout_points(sfss[1],fallout_current.angle,steps)))){
		rad_hr = 0;
	} else {
		//use this to also get max rad
		var max = sfss[1].max_cloud_rad;
		if(sfss[1].max_stem_rad>max) max = sfss[1].max_stem_rad;
		if(max>30000 && !allowhuge) max = 30000;
		max = Math.round(max);
		//first check the max
		if(is_inside_contour(max,sample_lat,sample_lon,gz_lat,gz_lon,steps)) {
			rad_hr = max;
		} else {
			rad_hr = search_between_contours(1,max,sample_lat,sample_lon,gz_lat,gz_lon,steps);
		}
	}	
	return rad_hr;
}

// this is sort of a simple binary search -- seems to work, usually no more than 13 steps, gets same results as brute force
function search_between_contours(low,high,sample_lat,sample_lon,gz_lat,gz_lon,steps) {
	half = Math.round((high+low)/2);
	if(high<=low||half<=low||high==low+1) return low;
	s1 = is_inside_contour(low,sample_lat,sample_lon,gz_lat,gz_lon,steps);
	s2 = is_inside_contour(half,sample_lat,sample_lon,gz_lat,gz_lon,steps);
	if(s1 && !s2) return search_between_contours(low,half,sample_lat,sample_lon,gz_lat,gz_lon,steps)
	if(!s1 && s2 ) return search_between_contours(half,high,sample_lat,sample_lon,gz_lat,gz_lon,steps)
	if(s1 && s2) return search_between_contours(half,high,sample_lat,sample_lon,gz_lat,gz_lon,steps)

	return false; //something went wrong
}

//for a given sample_lat and sample_lon, will work out if it is inside a given fallout contour
function is_inside_contour(rad,sample_lat,sample_lon,gz_lat,gz_lon,steps) {
	if(fallout_current.kt_frac&&fallout_current.airburst) {
		var sfss = fo.SFSS_fallout(fallout_current.kt_frac,[rad],(fallout_current.fission_fraction/100),fallout_current.wind);
	} else {
		var sfss = fo.SFSS_fallout(fallout_current.kt,[rad],(fallout_current.fission_fraction/100),fallout_current.wind);
	}	
	if(!point_in_poly([sample_lat,sample_lon],points_to_ll(gz_lat,gz_lon,fo.SFSS_fallout_points(sfss[rad],fallout_current.angle,steps)))){
		return 0;
	} else {
		return 1;
	}
}

//converts a series of points (which are distances from some central point in km)
//into latitude and longitude pairs based on their distances from the actual
//lat/lon of the central point
function points_to_ll(gzlat,gzlng, points) {
	var R = 6371; //Earth's mean radius in km
	var coords = [];
	for(var i=0;i<points.length;i++) {
		var lat = gzlat+rad2deg*(points[i][1]*mi2km/R);
		var lng = gzlng+rad2deg*(points[i][0]*mi2km/R/Math.cos(deg2rad*(gzlat)));
		coords.push([lat,lng]);
	}
	return coords;
}

//determines whether a point is in a given polygon
function point_in_poly(point, vs) {
	// ray-casting algorithm based on
	// http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

	var x = point[0]; 
	var y = point[1];

	var inside = false;
	for (i = 0, j = vs.length - 1; i < vs.length; j = i++) {
		xi = vs[i][0]; yi = vs[i][1];
		xj = vs[j][0]; yj = vs[j][1];
	
		intersect = ((yi > y) != (yj > y))
			&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}

//creates an array of distances of a list of coordinates ([lat,lon]) from a central lat/lon
function distances(lat,lon,coords) {
	var dists = [];
	for(var i in coords) {
		dists.push(distance_between(lat,lon,coords[i][0],coords[i][1]));
	}
	dists.sort(function(a, b){return a - b});
	return dists;
}

//clears fallout marker and all refresh events
function stop_fallout() {
	if(windsock_marker) windsock_marker = windsock_marker.remove();
	fallout_current = undefined;
	$("#theLegendFallout").html("");
}

//simple linear interpolation -- returns x3 for a given y3
function lerp(x1,y1,x2,y2,y3) {
	return ((y2-y3) * x1 + (y3-y1) * x2)/(y2-y1);
}

//linear interpolation that gets a log of all Y values first
function log_lerp(x1,y1,x2,y2,y3) {
	return lerp(x1,Math.log(y1),x2,Math.log(y2),Math.log(y3));
}

//same as Math.pow, just cleans up the function a bit
function pow(n,x) {
	return Math.pow(n,x);
}

function log(n) {
	return (Math.log(n));
}

function log10(n) {
	return (Math.log(n)) / (Math.LN10);
}

function unlog10(n) {
	return pow(10,n);
}

if (typeof register == 'function') { register("fallout.js"); }