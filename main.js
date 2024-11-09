let points = [
];

let vor, gr, _svg_, vor1


$(document).ready(function () {
	_svg_ = document.getElementById("voronoi");

	let h = _svg_.height.baseVal.value;
 	let w = _svg_.width.baseVal.value;

	points.forEach(element => {
		element.x *= w/100;
		element.y *= h/100;
	});
	
    vor = new Voronoi(points, w, h);    
    gr = new SVG_Graphics(_svg_);
	
	let t0 = performance.now();
	vor.update();
	let t1 = performance.now();
	$("#timer").text((t1 - t0).toFixed(2) + " ms");

    gr.draw(points,vor.voronoi_vertex,vor.edges, vor.maxCircle);

	$("#clear").on("click", function () {
		vor.point_list = [];
		points = [];
		_svg_.textContent = '';
        vor1.set_points([]);
		vor1.reset();
	});

	$("#voronoi").on("click", function (event) {
		let x = event.pageX - $(this).offset().left;
		let y = event.pageY - $(this).offset().top;
	
		/* Add point */
		let add = true;
		for(const p of points){
			let d = Math.sqrt((x-p.x)**2+(y-p.y)**2);
			if(d<3) add = false;
		}
		if(add)points.push(new Point(x, y));
		vor.point_list = points;
	
	
		let t0 = performance.now();
	
		vor.update();
	
		let t1 = performance.now();
	
		gr.draw(points, vor.voronoi_vertex, vor.edges, vor.maxCircle);
	
		$("#timer").text((t1 - t0).toFixed(2) + " ms");

        vor1.add_point(new PointD(x, y, 2));
        // vor1.partial_update(y);
        // vor1.add_point(new PointD(w1,h1*0.3,2));
        // vor1.partial_update(h1*0.8);
	});
});

$(document).ready(function () {
	let _svg_1= $("#chart1");
	let w1 = _svg_1[0].width.baseVal.value
	let h1 = _svg_1[0].height.baseVal.value
	vor1 = new VoronoiDiagram(_svg_1, true);

	// $("#reset-btn").on("click", function () {
	// 	vor1.set_points([]);
	// 	vor1.reset();
	// });
});
