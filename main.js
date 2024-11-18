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
        // vor1.set_points([]);
		// vor1.reset();
		voronoi.clearSites();
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

        // vor1.add_point(new PointD(x, y, 2));
        // vor1.partial_update(y);
        // vor1.add_point(new PointD(w1,h1*0.3,2));
        // vor1.partial_update(h1*0.8);

		// event handlers
		voronoi.addSite(x, y);
	});

	// File input event handler
	$('#fileInput').on('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                fileContent = e.target.result;
            };
            reader.readAsText(file);
        }
    });

	// Add points button event handler
    $('#addPoints').on('click', function () {
        const textInput = $('#textInput').val();
        
        // First, parse points from the text input
        if (textInput.trim() !== '') {
            updateVoronoi(textInput);
        }

        // Then, parse points from the file content if a file was selected
        if (fileContent.trim() !== '') {
            updateVoronoi(fileContent);
            fileContent = ''; // Clear fileContent after processing
        }

        // Clear the text input and file input
        $('#textInput').val('');
        $('#fileInput').val('');
    });
});

// $(document).ready(function () {
// 	let _svg_1= $("#chart1");
// 	let w1 = _svg_1[0].width.baseVal.value
// 	let h1 = _svg_1[0].height.baseVal.value
// 	vor1 = new VoronoiDiagram(_svg_1, true);

// 	$("#reset-btn").on("click", function () {
// 		vor1.set_points([]);
// 		vor1.reset();
// 	});
// });

// Function to parse points from input string and update voronoi
function updateVoronoi(input) {
    const regex = /\((\s*\d+\s*),(\s*\d+\s*)\)/g;
    let match;
    let h = _svg_.height.baseVal.value;
    let w = _svg_.width.baseVal.value;

    while ((match = regex.exec(input)) !== null) {
        const x = parseFloat(match[1].trim());
        const y = parseFloat(match[2].trim());

        // Scale points before adding
        let scaledX = x * w / 100;
        let scaledY = y * h / 100;

        // Check if the point is too close to existing points
        let add = true;
        for (const p of points) {
            let d = Math.sqrt((scaledX - p.x) ** 2 + (scaledY - p.y) ** 2);
            if (d < 3) {
                add = false;
                break;
            }
        }

        if (add) {
            let newPoint = new Point(scaledX, scaledY);
            points.push(newPoint);
            vor.point_list = points;

			let t0 = performance.now();
	
			vor.update();
		
			let t1 = performance.now();
		
			gr.draw(points, vor.voronoi_vertex, vor.edges, vor.maxCircle);
		
			$("#timer").text((t1 - t0).toFixed(2) + " ms");
	
			// vor1.add_point(new PointD(x, y, 2));
			// vor1.partial_update(y);
			// vor1.add_point(new PointD(w1,h1*0.3,2));
			// vor1.partial_update(h1*0.8);
	
			// event handlers
			voronoi.addSite(scaledX, scaledY);
        }
    }
}
