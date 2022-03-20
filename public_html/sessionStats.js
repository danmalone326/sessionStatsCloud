
var jsonURL = "https://velookup.glaarg.org/websiteStatsDetail"
// var jsonURL = "sessionStats.json"

var fontSizeMin = 10;
var fontSizeMax = 100;

var fontFamily = "Impact";

var padding = 0.15;

var rotateStops = 6;  // minimum 2, to make all same rotation, set max=min
var rotateMin = -45;
var rotateMax = 45;

var svgWidth = 1280;
var svgHeight = 720;

const urlParams = new URLSearchParams(window.location.search);

// Routines for loading the JSON stats file
var getJSON = function(url, callback) {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, true);
					xhr.responseType = 'json';
					xhr.onload = function() {
						var status = xhr.status;
						if (status === 200) {
							callback(null, xhr.response);
						} else {
							callback(status, xhr.response);
						}
					};
					xhr.send();
				};

function loadJSON (url) {
	getJSON(jsonURL,
			function(err, data) {
				if (err !== null) {
					alert('Something went wrong: ' + err);
				} else {
					gotNewStats(data);
				}
			});
}


var rankColors = [
	{"rank": 300, "color": "rgb(255, 105, 180)"},
	{"rank": 250, "color": "rgb(153, 102, 204)"},
	{"rank": 200, "color": "rgb(100, 149, 237)"},
	{"rank": 150, "color": "rgb(240, 93, 93)"},
	{"rank": 100, "color": "rgb(204, 122, 0)"},
	{"rank": 50, "color": "rgb(171, 132, 12)"},
	{"rank": 40, "color": "rgb(0, 121, 121)"},
	{"rank": 30, "color": "rgb(54, 41, 88)"},
	{"rank": 20, "color": "rgb(81, 113, 51)"},
	{"rank": 10, "color": 'rgb(62, 87, 40)'},
	{"rank": 5, "color": 'rgb(24, 63, 99)'},
	{"rank": 0, "color": 'rgb(0,0,0)'},
];

// returns the appropriate color based on the number of sessions
function rankColor(sessions) {
	rank = rankColors.find(function (r,i,a) {
				if(sessions>=r.rank) {
					return true;
				}
				return false;
		});
	return rank.color;
}

function getColor(i,count) {
	if (urlParams.has("colorful")) {
		return d3.schemeCategory10[count % d3.schemeCategory10.length];
	} else {
		return rankColor(i.overallSessionCount);
	}
}

var tooltipDivID="tooltip";
var tooltipID="tooltip";
var tooltipRowID="tooltipRow";

function setTooltip(event) {
	var tooltip = event.target.getAttribute("tooltip");

	var t = tooltip.split(",");
// 	var tooltipHTML = t[0]+" "+t[1]+" "+t[2]+"<br>Sessions: "+t[3];
	document.getElementById(tooltipID+"1").innerHTML=t[0];
	document.getElementById(tooltipID+"2").innerHTML=t[1];
	document.getElementById(tooltipID+"3").innerHTML=t[2];
	document.getElementById(tooltipID+"4").innerHTML=t[3];
	document.getElementById(tooltipID+"5").innerHTML=t[4];
    
// 	var tooltipDiv=document.getElementById(tooltipDivID);
// 	tooltipDiv.innerHTML = tooltipHTML;
	
	document.getElementById(tooltipRowID).style.visibility = 'visible';
// 	tooltipDiv.style.visibility = 'visible';
}

function hideTooltip(event) {
// 	var tooltipDiv=document.getElementById(tooltipDivID);
// 	tooltipDiv.style.visibility = 'hidden';
	document.getElementById(tooltipRowID).style.visibility = 'hidden';
}

function wordCloud(selector) {
	// called when update completes the layout
	// this will draw the svg onto the page
	function draw(words) {
	  d3.select(selector).append("svg")
		.attr("viewBox", "0 0 "+svgWidth+" "+svgHeight)
		.append("g")
		.attr("transform", "translate(" + svgWidth / 2 + "," + svgHeight / 2 + ")")
		.selectAll("text")
		.data(words)
		.enter().append("text")
		.style("font-size", function(d) { return d.size + "px"; })
		.style("font-family", fontFamily)
		.style("fill", function(d, i) { return d.color; })
		.attr("text-anchor", "middle")
		.attr("tooltip",function(d) {return d.tooltip;})
		.on("mouseover", setTooltip)
		.on("mouseout", hideTooltip)
		.attr("transform", function(d) {
					return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
				})
		.text(function(d) { return d.text; });
	}
	
	// this is basically a public function 'update' for the wordCloud object
	// call this with an array of word objects with text, size, color, and rotate
return {
			update: function(words) {
				d3.layout.cloud()
					.size([svgWidth, svgHeight])
					.words(words)
					.padding(padding)
					.rotate(function(d) { return d.rotate; })
					.font(fontFamily)
					.fontSize(function(d) { return d.size; })
					.on("end", draw)
					.start();
			}
		}

}

var myWordCloud = wordCloud("#svgWrapperDiv");


function wordsByCallsign(stats) {
	var words = [];

	// must have at least this many sessions to be included in stats
	var statSessionCountRequired = 1;

	// first find the max and min values and standings
	var coolStats = {};
	var minSessions = 999;
	var maxSessions = 0;
	var totalWords = 0;
	stats.forEach(function (i) {
		if (i.overallSessionCount >= statSessionCountRequired) {
			totalWords += 1;
			if (i.overallSessionCount > maxSessions) { maxSessions = i.overallSessionCount; }
			if (i.overallSessionCount < minSessions) { minSessions = i.overallSessionCount; }
			if (i.overallSessionCount in coolStats) {
				coolStats[i.overallSessionCount].count += 1;
			} else {
				coolStats[i.overallSessionCount] = {};
				coolStats[i.overallSessionCount].count = 1;
			}
		}
	});
	
	// calculate the stats for each session count
	for (var key in coolStats) {
		coolStats[key].countHigher = 0;
		coolStats[key].countLower = 0;
		for (var key2 in coolStats) {
			if (parseInt(key) > parseInt(key2)) {
				coolStats[key].countLower += coolStats[key2].count;
			} else if (parseInt(key) < parseInt(key2)) {
				coolStats[key].countHigher += coolStats[key2].count;
			}
		}
		coolStats[key].place = coolStats[key].countHigher + 1;
		coolStats[key].percentile = coolStats[key].countHigher / totalWords * 100;
		coolStats[key].percentileRank = coolStats[key].percentile / (100 * (totalWords+1));
	}
	// console.log(coolStats);

	// create word entries and compute size, color, and rotation for each VE
	stats.forEach(function (i, count) {
		if (i.overallSessionCount >= statSessionCountRequired) {		
			var word = {
					"text": i.veCallSign, 
					"size": (i.overallSessionCount / (maxSessions-minSessions+1) * (fontSizeMax-fontSizeMin))+fontSizeMin,
					"color": getColor(i,count),
					"rotate": (Math.floor(Math.random() * rotateStops) * (rotateMax-rotateMin) / (rotateStops-1)) + rotateMin,
					"tooltip": [i.veNumber+"-"+i.veCallSign+" "+i.vePreferredName,
								i.overallSessionCount + " (" + nth(coolStats[i.overallSessionCount].place) + " - top " + Math.ceil(coolStats[i.overallSessionCount].percentile) +"%)",
								i.remoteSessionCount,
								i.applicantCount,
								i.newLicenses+i.newUpgrades].join(),
				};
			
			// Overrides go here
			if (i.overallSessionCount == maxSessions) {
				word["rotate"] = 0;
			}
		
			words.push(word);
		}
	});

	return words;
}

function wordsGroupedByName(stats) {
	var words = [];

	var names = [];
	stats.forEach(function (i) {
		if (i.overallSessionCount > 0) {
			var index = names.findIndex(function(value) {
												return value.name == i.vePreferredName;
											});
			if (index == -1) {
				names.push(
							{
								"name": i.vePreferredName,
								"count": 1, 
								"overallSessionCount": i.overallSessionCount,
								"remoteSessions": i.remoteSessionCount,
								"remoteExaminees": i.applicantCount,
								"remoteElementsPassed": i.newLicenses+i.newUpgrades,
							}
						)
			} else {
				names[index].count += 1;
				names[index].overallSessionCount += i.overallSessionCount;
				names[index].remoteSessions += i.remoteSessionCount;
				names[index].remoteExaminees += i.applicantCount;
				names[index].remoteElementsPassed += i.newLicenses+i.newUpgrades;
			}
		}
	});

	// first find the max and min values and standings
	var standing = {};
	var minSessions = 999;
	var maxSessions = 0;
	names.forEach(function (i) {
		if (i.overallSessionCount > maxSessions) { maxSessions = i.overallSessionCount; }
		if (i.overallSessionCount < minSessions) { minSessions = i.overallSessionCount; }
		if (i.overallSessionCount in standing) {standing[i.overallSessionCount]+=1} else {standing[i.overallSessionCount]=1}
	});
	
	// Needed a reverse sort, but this was easier
	var tempArray = [];
	for (var key in standing) {
		tempArray.push(key);
	}
	
	var currentStanding=1;
	while (tempArray.length) {
		key = tempArray.pop();
		temp = standing[key];
		standing[key] = currentStanding;
		currentStanding += temp;
	}
	// end of standings	

	// create word entries and compute size, color, and rotation for each VE
	names.forEach(function (i, count) {
    	var word = {
    			"text": i.name, 
    			"size": (i.overallSessionCount / (maxSessions-minSessions+1) * (fontSizeMax-fontSizeMin))+fontSizeMin,
    			"color": getColor(i,count),
    			"rotate": (Math.floor(Math.random() * rotateStops) * (rotateMax-rotateMin) / (rotateStops-1)) + rotateMin,
   				"tooltip": [i.count+" "+i.name+" VE"+(i.count!==1?"s":""),
   				            i.overallSessionCount + " (" + nth(standing[i.overallSessionCount]) + ")",
   				            i.remoteSessions,
   				            i.remoteExaminees,
   				            i.remoteElementsPassed].join(),
			};
			
		// Overrides go here
    	if (i.overallSessionCount == maxSessions) {
    		word["rotate"] = 0;
    	}
    	
    	words.push(word);
	});

	return words;
}

function nth(d) {
	if (d > 3 && d < 21) return d+'th';
	switch (d % 10) {
    	case 1:  return d+"st";
    	case 2:  return d+"nd";
    	case 3:  return d+"rd";
    default: return d+"th";
  }
}

// Called when new JSON data is here
function gotNewStats(stats) {

	var words = [];

	// seed the random number generator so we get repeatable patterns
	// pattern will change every time the stats are updated
	// for now also change the pattern at least every day
	var d = new Date();
	Math.seedrandom(JSON.stringify(stats)+d.getUTCDate());

	if (urlParams.has("name")) {
		words = wordsGroupedByName(stats);
	} else {
		words = wordsByCallsign(stats);
	}

	myWordCloud.update(words);
}

// This starts the process
loadJSON(jsonURL);

