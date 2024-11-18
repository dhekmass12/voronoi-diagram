class Voronoi {
    /**
     * Initializes the Voronoi diagram with given points and bounding box dimensions.
     * points = Array of points to generate the Voronoi diagram.
     * width = Width of the bounding box.
     * height = Height of the bounding box.
     */
    constructor(points, width, height) {
        this.point_list = points;
        this.reset();
        this.box_x = width;
        this.box_y = height;
        this.maxCircle = {
            x: [],
            y: [],
            radius: 0
        };
    }

    /**
     * Resets the Voronoi diagram to its initial state.
     */
    reset() {
        this.event_list = new SortedQueue();
        this.beachline_root = null;
        this.voronoi_vertex = [];
        this.edges = [];
        this.maxCircle = {
            x: [],
            y: [],
            radius: 0
        };
    }

    /**
     * Updates the Voronoi diagram by processing all events.
     */
    update() {
        this.reset();
        let points = [];
        let e = null;

        // Initialize point events
        for (const p of this.point_list) {
            points.push(new Event("point", p));
        }
        this.event_list.points = points;

        // Process all events
        if (this.event_list.length > 0) {
            while (this.event_list.length > 0) {
                e = this.event_list.extract_first();
                if (e.type === "point") {
                    this.point_event(e.position);
                } else if (e.active) {
                    this.circle_event(e);
                }
                // last_event = e.position;
            }
            this.complete_segments(e.position);
        }
    }

    /**
     * Handles a site (point) event by updating the beachline.
     * p=The point where the event occurs.
     */
    point_event(p) {
        let q = this.beachline_root;

        // If beachline is empty, initialize with the first arc
        if (q === null) {
            this.beachline_root = new Arc(null, null, p, null, null);
        } else {
            // Traverse the beachline to find the correct position for the new arc
            while (
                q.right !== null &&
                this.parabola_intersection(p.y, q.focus, q.right.focus) <= p.x
            ) {
                q = q.right;
            }

            // Create new edges for the split
            let e_qp = new Edge(q.focus, p, p.x);
            let e_pq = new Edge(p, q.focus, p.x);

            // Create new arcs resulting from the insertion
            let arc_p = new Arc(q, null, p, e_qp, e_pq);
            let arc_qr = new Arc(arc_p, q.right, q.focus, e_pq, q.edge.right);

            if (q.right) {
                q.right.left = arc_qr;
            }
            arc_p.right = arc_qr;
            q.right = arc_p;
            q.edge.right = e_qp;

            // Deactivate any existing circle event associated with the old arc
            if (q.event) {
                q.event.active = false;
            }

            // Check for potential new circle events due to the new arcs
            this.add_circle_event(p, q);
            this.add_circle_event(p, arc_qr);

            // Add new edges to the edge list
            this.edges.push(e_qp, e_pq);
        }
    }

    /**
     * Handles a circle event by updating the beachline and edges.
     * e = The circle event to process.
     */
    circle_event(e) {
        let arc = e.caller;
        let p = e.position;

        // Create a new edge between the left and right focus of the collapsing arc
        let edge_new = new Edge(arc.left.focus, arc.right.focus);

        // Deactivate any existing circle events related to the neighboring arcs
        if (arc.left.event) arc.left.event.active = false;
        if (arc.right.event) arc.right.event.active = false;

        // Update the beachline by removing the collapsing arc
        arc.left.edge.right = edge_new;
        arc.right.edge.left = edge_new;
        arc.left.right = arc.right;
        arc.right.left = arc.left;

        // Add the new edge to the edge list
        this.edges.push(edge_new);

        // Add the new vertex if it's within the bounding box
        if (!this.point_outside(e.vertex)) {
            this.voronoi_vertex.push(e.vertex);
        }

        // Update the ends of the old edges to the new vertex
        arc.edge.left.end = arc.edge.right.end = edge_new.start = e.vertex;

        // Check for new circle events caused by the updated beachline
        this.add_circle_event(p, arc.left);
        this.add_circle_event(p, arc.right);

        // Calculate the radius of the circle event
        let circle_radius = Number.MAX_SAFE_INTEGER;

        if (arc.left.left && arc.left.right) {
            const focus = arc.left.focus;
            let circle_radius_left = Math.sqrt(
                Math.pow(e.vertex.x - focus.x, 2) +
                Math.pow(e.vertex.y - focus.y, 2)
            );
            circle_radius = Math.min(circle_radius, circle_radius_left);
        }

        if (arc.right.left && arc.right.right) {
            const focus = arc.right.focus;
            let circle_radius_right = Math.sqrt(
                Math.pow(e.vertex.x - focus.x, 2) +
                Math.pow(e.vertex.y - focus.y, 2)
            );
            circle_radius = Math.min(circle_radius, circle_radius_right);
        }

        // Update the maximum circle information
        if (this.maxCircle.radius === circle_radius) {
            this.maxCircle.x.push(e.vertex.x);
            this.maxCircle.y.push(e.vertex.y);
        } else if (this.maxCircle.radius < circle_radius) {
            this.maxCircle.x = [e.vertex.x];
            this.maxCircle.y = [e.vertex.y];
            this.maxCircle.radius = circle_radius;
        }
    }

    /**
     * Adds a potential circle event based on the current beachline.
     * p = The current point being processed.
     * arc = The arc to check for a circle event.
     */
    add_circle_event(p, arc) {
        if (arc.left && arc.right) {
            let a = arc.left.focus;
            let b = arc.focus;
            let c = arc.right.focus;

            // Check if the three points form a valid circle event
            if (((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) > 0) {
                let new_inters = this.edge_intersection(arc.edge.left, arc.edge.right);
                if (!new_inters) return;

                let circle_radius = Math.sqrt(
                    Math.pow(new_inters.x - arc.focus.x, 2) +
                    Math.pow(new_inters.y - arc.focus.y, 2)
                );

                let event_pos = circle_radius + new_inters.y;

                // Ensure the event is valid and within the bounding box
                if (event_pos > p.y && new_inters.y < this.box_y) {
                    let e = new Event(
                        "circle",
                        new Point(new_inters.x, event_pos),
                        arc,
                        new_inters
                    );
                    arc.event = e;
                    this.event_list.insert(e);
                }
            }
        }
    }

    /**
     * Computes the x-coordinate where two parabolas intersect.
     * y = The current sweep line position.
     * f1 = Focus of the first parabola.
     * f2 = Focus of the second parabola.
     * returns The x-coordinate of intersection.
     */
    parabola_intersection(y, f1, f2) {
        let fyDiff = f1.y - f2.y;
        if (fyDiff === 0) return (f1.x + f2.x) / 2;

        let fxDiff = f1.x - f2.x;
        let b1md = f1.y - y;
        let b2md = f2.y - y;
        let h1 = (-f1.x * b2md + f2.x * b1md) / fyDiff;
        let h2 = Math.sqrt(b1md * b2md * (Math.pow(fxDiff, 2) + Math.pow(fyDiff, 2))) / fyDiff;

        return h1 + h2; // Left x-coordinate of intersection
    }

    /**
     * Finds the intersection point of two edges.
     * e1 =  The first edge.
     * e2 =  The second edge.
     * returns The intersection point or null if parallel.
     */
    edge_intersection(e1, e2) {
        if (e1.m === Infinity) {
            return new Point(e1.start.x, e2.getY(e1.start.x));
        } else if (e2.m === Infinity) {
            return new Point(e2.start.x, e1.getY(e2.start.x));
        } else {
            let mdif = e1.m - e2.m;
            if (mdif === 0) return null; // Parallel edges
            let x = (e2.q - e1.q) / mdif;
            let y = e1.getY(x);
            return new Point(x, y);
        }
    }

    /**
     * Completes all edge segments by intersecting them with the bounding box.
     * last =  The last event position.
     */
    complete_segments(last) {
        let r = this.beachline_root;
        let e, x, y;

        // Complete edges attached to the beachline
        while (r.right) {
            e = r.edge.right;
            x = this.parabola_intersection(last.y * 1.1, e.arc.left, e.arc.right);
            y = e.getY(x);

            // Determine the endpoint based on intersection
            if (
                (e.start.y < 0 && y < e.start.y) ||
                (e.start.x < 0 && x < e.start.x) ||
                (e.start.x > this.box_x && x > e.start.x)
            ) {
                e.end = e.start; // Invalid edge, mark for deletion
            } else {
                y = (e.m * (x - e.start.x) <= 0) ? 0 : this.box_y;
                e.end = this.edge_end(e, y);
            }
            r = r.right;
        }

        let option;

        // Adjust edges to ensure they lie within the bounding box
        for (let i = 0; i < this.edges.length; i++) {
            e = this.edges[i];
            if (!e) continue;

            option = (this.point_outside(e.start) ? 1 : 0) + (this.point_outside(e.end) ? 2 : 0);

            switch (option) {
                case 3: // Both endpoints outside
                    this.edges[i] = null;
                    break;
                case 1: // Start is outside
                    y = (e.start.y < e.end.y) ? 0 : this.box_y;
                    e.start = this.edge_end(e, y);
                    break;
                case 2: // End is outside
                    y = (e.end.y < e.start.y) ? 0 : this.box_y;
                    e.end = this.edge_end(e, y);
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * Calculates the endpoint of an edge based on the y-coordinate limit.
     * e =  The edge to adjust.
     * y_lim =  The y-coordinate limit.
     * returns The adjusted endpoint.
     */
    edge_end(e, y_lim) {
        let x = Math.min(this.box_x, Math.max(0, e.getX(y_lim)));
        let y = e.getY(x);
        let p = new Point(x, y);
        this.voronoi_vertex.push(p);
        return p;
    }

    /**
     * Checks if a point is outside the bounding box.
     * p =  The point to check.
     * returns  True if the point is outside, else false.
     */
    point_outside(p) {
        return p.x < 0 || p.x > this.box_x || p.y < 0 || p.y > this.box_y;
    }
}

/**
 * Represents an arc in the beachline.
 */
class Arc {
    /**
     * Initializes an arc with optional neighboring arcs and associated edges.
     * l =  The left neighboring arc.
     * r =  The right neighboring arc.
     * f=  The focus point of the arc.
     * el =  The left edge.
     * er =  The right edge.
     */
    constructor(l, r, f, el, er) {
        this.left = l;
        this.right = r;
        this.focus = f;
        this.edge = { left: el, right: er };
        this.event = null;
    }
}

/**
 * Represents a point in 2D space.
 */
class Point {
    /**
     * Initializes a point with x and y coordinates.
     * x =  The x-coordinate.
     * y =  The y-coordinate.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/**
 * Represents an edge between two foci in the Voronoi diagram.
 */
class Edge {
    /**
     * Initializes an edge given two points and an optional starting x-coordinate.
     * p1 =  The first focus point.
     * p2 = The second focus point.
     * startx = The starting x-coordinate for the edge.
     */
    constructor(p1, p2, startx) {
        this.m = -(p1.x - p2.x) / (p1.y - p2.y);
        this.q = (0.5 * (Math.pow(p1.x, 2) - Math.pow(p2.x, 2) + Math.pow(p1.y, 2) - Math.pow(p2.y, 2))) / (p1.y - p2.y);
        this.arc = { left: p1, right: p2 };
        this.end = null;
        this.start = null;
        if (startx) {
            this.start = new Point(
                startx,
                this.m !== Infinity ? this.getY(startx) : null
            );
        }
    }

    /**
     * Calculates the y-coordinate on the edge for a given x-coordinate.
     * x= The x-coordinate.
     * returns The corresponding y-coordinate.
     */
    getY(x) {
        return x * this.m + this.q;
    }

    /**
     * Calculates the x-coordinate on the edge for a given y-coordinate.
     * y = The y-coordinate.
     * returns The corresponding x-coordinate.
     */
    getX(y) {
        if (this.m === Infinity) return this.start.x;
        return (y - this.q) / this.m;
    }
}

/**
 * Represents an event in the Voronoi diagram (point or circle event).
 */
class Event {
    /**
     * Initializes an event.
     * @param {string} type - The type of the event ("point" or "circle").
     * @param {Point} position - The position of the event.
     * @param {Arc|null} caller - The arc associated with the event (for circle events).
     * @param {Point|null} vertex - The vertex associated with the event (for circle events).
     */
    constructor(type, position, caller = null, vertex = null) {
        this.type = type;
        this.caller = caller;
        this.position = position;
        this.vertex = vertex;
        this.active = true;
    }
}

/**
 * Manages a sorted queue of events based on their y and x coordinates.
 */
class SortedQueue {
    /**
     * Initializes the sorted queue with optional events.
     * @param {Event[]} [events] - Initial list of events.
     */
    constructor(events = []) {
        this.list = [];
        if (events) this.list = events;
        this.sort();
    }

    /**
     * Gets the number of events in the queue.
     * returns The length of the queue.
     */
    get length() {
        return this.list.length;
    }

    /**
     * Extracts and returns the first event in the queue.
     * returns The first event or null if the queue is empty.
     */
    extract_first() {
        if (this.list.length > 0) {
            let elm = this.list[0];
            this.list.splice(0, 1);
            return elm;
        }
        return null;
    }

    /**
     * Inserts a new event into the queue and maintains the sorted order.
     * event = The event to insert.
     */
    insert(event) {
        this.list.push(event);
        this.sort();
    }

    /**
     * Sets the list of point events and sorts the queue.
     * events = The list of point events.
     */
    set points(events) {
        this.list = events;
        this.sort();
    }

    /**
     * Sorts the event list based on y and x coordinates.
     */
    sort() {
        this.list.sort(function (a, b) {
            let diff = a.position.y - b.position.y;
            if (diff === 0) return a.position.x - b.position.x; // Leftmost first if y is equal
            return diff;
        });
    }
}