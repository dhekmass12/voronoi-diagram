let vor1

(function () {
	let _svg_1 = document.getElementById("chart1")
	let w1 = _svg_1[0].width.baseVal.value
	let h1 = _svg_1[0].height.baseVal.value
	vor1 = new VoronoiDebug(_svg_1, true);

	// let p_list = [new PointD(w1*0.4,h1*0.3,2), new PointD(w1*0.8,h1*0.1,2)]
 	// vor1.set_points(p_list);
	vor1.add_point(new PointD(w1*0.4,h1*0.1,2));
	vor1.partial_update(h1*0.3);
	vor1.add_point(new PointD(w1*0.8,h1*0.3,2));
	vor1.partial_update(h1*0.8);
})();
