//this global variable will be populated by city_data.js
var cities = [];

//for a given target_lat and target_lng, will search over an array of
//lats and lons and return the closest one. if a target_country code is indicated,
//will preferentially return a result from that country. if result is too far
//away, will return the capital. if a target_country is supplied but it gets
//no result, will see if it can get a result without a target_country. 
function closest_city(target_lat,target_lng,target_country) {
	var distance;
	var best_distance = 0;
	var best_index = -1;
	var target_capital = undefined;
	for(var i=0;i<cities.length;i++) {
		var lat = cities[i][0];
		var lon = cities[i][1];
		var country = cities[i][2];
		var capital = cities[i][3];
		if(typeof target_country != "undefined") {
			if(country==target_country) {
				distance = distance_between(target_lat,target_lng,lat,lon);
				if(distance<best_distance||(best_distance==0)) {
					best_distance = distance;
					best_index = i;
				}
				if(capital) target_capital = i;
			}
		} else {
			distance = distance_between(target_lat,target_lng,lat,lon);
			if(distance<best_distance||(best_distance==0)) {
				best_distance = distance;
				best_index = i;
			}
		}
	}
	//if best is more than 200 km, and we have a capital, just use the capital
	if(best_distance>200 && typeof target_capital !="undefined") best_index = target_capital;

	if(best_index>-1) {
		return {lat:cities[best_index][0],lon:cities[best_index][1],country:cities[best_index][2],capital:cities[best_index][3]};
	} else {
		if(typeof target_country == "undefined") return false;
		//try without the country code
		var closest2 = closest_city(target_lat,target_lng,undefined);
		if(closest2!=false) return closest2;		
		return false;
	}
}

