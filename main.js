// Initialize global variables
let points = [];
let vor, gr, _svg_, vor1;
let fileContent = '';

$(document).ready(function () {
    // Get the SVG element
    _svg_ = document.getElementById("voronoi");

    // Get the dimensions of the SVG element
    let h = _svg_.height.baseVal.value;
    let w = _svg_.width.baseVal.value;

    // Scale points based on SVG dimensions
    points.forEach(element => {
        element.x *= w / 100;
        element.y *= h / 100;
    });

    // Initialize Voronoi and SVG_Graphics objects
    vor = new Voronoi(points, w, h);
    gr = new SVG_Graphics(_svg_);

    // Measure and display the time taken to update the Voronoi diagram
    let t0 = performance.now();
    vor.update();
    let t1 = performance.now();
    $("#timer").text((t1 - t0).toFixed(2) + " ms");

    // Draw the initial Voronoi diagram
    gr.draw(points, vor.voronoi_vertex, vor.edges, vor.maxCircle);

    // Clear button event handler
    $("#clear").on("click", function () {
        vor.point_list = [];
        points = [];
        _svg_.textContent = '';
        voronoi.clearSites();
		$('#timer').text("0.00 ms");
    });

    // Voronoi SVG click event handler
    $("#voronoi").on("click", function (event) {
        let x = event.pageX - $(this).offset().left;
        let y = event.pageY - $(this).offset().top;

        // Check if the point is too close to existing points
        let add = true;
        for (const p of points) {
            let d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
            if (d < 3) add = false;
        }

        // Add the point if it's not too close to existing points
        if (add) points.push(new Point(x, y));
        vor.point_list = points;

        // Measure and display the time taken to update the Voronoi diagram
        let t0 = performance.now();
        vor.update();
        let t1 = performance.now();
        gr.draw(points, vor.voronoi_vertex, vor.edges, vor.maxCircle);
        $("#timer").text((t1 - t0).toFixed(2) + " ms");

        // Add the site to the Voronoi diagram
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

        // Parse points from the text input
        if (textInput.trim() !== '') {
            updateVoronoi(textInput);
        }

        // Parse points from the file content if a file was selected
        if (fileContent && fileContent.trim() !== '') {
            updateVoronoi(fileContent);
            fileContent = ''; // Clear fileContent after processing
        }

        // Clear the text input and file input
        $('#textInput').val('');
        $('#fileInput').val('');
    });
});

// Function to parse points from input string and update Voronoi diagram
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

        // Add the point if it's not too close to existing points
        if (add) {
            let newPoint = new Point(scaledX, scaledY);
            points.push(newPoint);
            vor.point_list = points;

            // Measure and display the time taken to update the Voronoi diagram
            let t0 = performance.now();
            vor.update();
            let t1 = performance.now();
            gr.draw(points, vor.voronoi_vertex, vor.edges, vor.maxCircle);
            $("#timer").text((t1 - t0).toFixed(2) + " ms");

            // Add the site to the Voronoi diagram
            voronoi.addSite(scaledX, scaledY);
        }
    }
}