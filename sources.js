rasterLayers={"Normal":{"url":"https:\/\/{s}.tile.thunderforest.com\/atlas\/{z}\/{x}\/{y}{r}.png?apikey=f1ef406f103b466e86381e9a8c59ea8f","minZoom":2,"maxZoom":18,"attribution":"&copy; <a href=\"https:\/\/www.thunderforest.com\/\" target=\"_blank\">Thunderforest<\/a> &copy; <a href=\"https:\/\/www.openstreetmap.org\/about\" target=\"_blank\">OpenStreetMap<\/a>","sourcekey":"thunderforest_atlas","provider":"thunderforest","tileSize":512},"Satellite":{"url":"https:\/\/mt0.google.com\/vt\/lyrs=y&hl=en&x={x}&y={y}&z={z}&scale=2","minZoom":2,"maxZoom":17,"attribution":"Satellite imagery &copy; Google","sourcekey":"google_satellite","provider":"google","tileSize":512},"Dark":{"url":"https:\/\/tiles.stadiamaps.com\/tiles\/alidade_smooth_dark\/{z}\/{x}\/{y}{r}.png?api_key=ba809e9a-d6ea-40a2-b1a8-2da38d67a541","minZoom":2,"maxZoom":18,"attribution":"&copy; <a href=\"https:\/\/stadiamaps.com\/\" target=\"_blank\">Stadia Maps<\/a> &copy; <a href=\"https:\/\/openmaptiles.org\/\" target=\"_blank\">OpenMapTiles<\/a> &copy; <a href=\"https:\/\/www.openstreetmap.org\/about\" target=\"_blank\">OpenStreetMap<\/a>","sourcekey":"stadia_dark","provider":"stadia","tileSize":512}};
vectorLayers=[{name: "Normal", style: dynamicAssets+"mapdata/styles/?style=normal", default:true},{name: "Satellite", style: dynamicAssets+"mapdata/styles/?style=satellite"},{name: "Dark", style: dynamicAssets+"mapdata/styles/?style=dark"}];
pRasterLayers=()=>{
return {
"Normal":{
layers: [
{
"type": "protomapsL",
"style": pmapl.json_style(MAPUI.stylejson["normal"],MAPUI.fonts,MAPUI.stylejson["normal"].sources.osm_pmtiles.tiles[0]),
"sourcekey": "osm_pmtiles_20231025",
"provider": "pmtiles",
"attribution": "<a href=\"https://protomaps.com/\" target=\"_blank\">Protomaps</a> &copy; <a href=\"https://www.openstreetmap.org/about\" target=\"_blank\">OpenStreetMap</a>",
}
]
}



}
};