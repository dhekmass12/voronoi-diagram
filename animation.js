var voronoi = {
  // Properties
  sites: [],
  siteEvents: [],
  circEvents: [],
  arcs: [],
  edges: [],
  sweep: 0,
  SITE_EVENT: 0,
  CIRCLE_EVENT: 1,
  VOID_EVENT: -1,
  DEFAULT_NUM_SITES: 0,
  NUM_SITES_PROCESSED: 0,
  BINARY_SEARCHES: 0,
  BINARY_SEARCH_ITERATIONS: 0,
  PARABOLIC_CUT_CALCS: 0,
  ALL_PARABOLIC_CUT_CALCS: 0,
  BEACHLINE_SIZE: 0,
  CIRCLE_QUEUE_SIZE: 0,
  NUM_VOID_EVENTS: 0,
  NUM_CIRCLE_EVENTS: 0,
  TOTAL_NUM_EDGES: 0,
  NUM_DESTROYED_EDGES: 0,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  random: Math.random,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  PI: Math.PI,
  isNaN: Number.isNaN,
  DEFAULT_CANVAS_WIDTH: 500,
  DEFAULT_CANVAS_HEIGHT: 300,
  canvas: null,
  canvasMargin: 0,
  bbox: { xl: 0, xr: 500, yt: 0, yb: 300 },

  // Object Constructors
  Beachsection: function (site) {
    this.site = site;
    this.edge = null;
    this.sweep = -Infinity;
    this.lid = 0;
    this.circleEvent = undefined;
  },

  Site: function (x, y) {
    this.id = this.constructor.prototype.idgenerator++;
    this.x = x;
    this.y = y;
  },

  Cell: function (site) {
    this.site = site;
    this.halfedges = [];
  },

  Edge: function (lSite, rSite) {
    this.id = this.constructor.prototype.idgenerator++;
    this.lSite = lSite;
    this.rSite = rSite;
    this.va = this.vb = undefined;
  },

  Vertex: function (x, y) {
    this.x = x;
    this.y = y;
  },

  Halfedge: function (site, edge) {
    this.site = site;
    this.edge = edge;
  },

  // Initialization Method
  init: function () {
    // Assign parent reference and utility functions to Beachsection
    this.Beachsection.prototype.PARENT = this;
    this.Beachsection.prototype.sqrt = Math.sqrt;

    // Define parabolic intersection calculation
    this.Beachsection.prototype._leftParabolicCut = function (
      site,
      left,
      directrix
    ) {
      this.PARENT.PARABOLIC_CUT_CALCS++;
      var rfocx = site.x;
      var rfocy = site.y;

      // Handle degenerate case where focus is on the directrix
      if (rfocy === directrix) return rfocx;

      var lfocx = left.x;
      var lfocy = left.y;

      if (lfocy === directrix) return lfocx;

      // If both parabolas have the same distance to directrix, return midpoint
      if (rfocy === lfocy) return (rfocx + lfocx) / 2;

      // Calculate breakpoint
      var pby2 = rfocy - directrix;
      var plby2 = lfocy - directrix;
      var hl = lfocx - rfocx;
      var aby2 = 1 / pby2 - 1 / plby2;
      var b = hl / plby2;
      return (
        (-b +
          this.sqrt(
            b * b -
              2 *
                aby2 *
                ((hl * hl) / (-2 * plby2) -
                  lfocy +
                  plby2 / 2 +
                  rfocy -
                  pby2 / 2)
          )) /
          aby2 +
        rfocx
      );
    };

    // Cached parabolic cut
    this.Beachsection.prototype.leftParabolicCut = function (left, sweep) {
      this.PARENT.ALL_PARABOLIC_CUT_CALCS++;
      if (this.sweep !== sweep || this.lid !== left.id) {
        this.sweep = sweep;
        this.lid = left.id;
        this.lBreak = this._leftParabolicCut(this.site, left, sweep);
      }
      return this.lBreak;
    };

    // Check if the beach section is collapsing
    this.Beachsection.prototype.isCollapsing = function () {
      return (
        this.circleEvent !== undefined &&
        this.circleEvent.type === this.PARENT.CIRCLE_EVENT
      );
    };

    // Initialize ID generators
    this.Site.prototype.idgenerator = 1;
    this.Edge.prototype.idgenerator = 1;

    // Methods for Edge to check if it's a line segment
    this.Edge.prototype.isLineSegment = function () {
      return Boolean(this.id) && Boolean(this.va) && Boolean(this.vb);
    };

    // Methods for Halfedge to check if it's a line segment
    this.Halfedge.prototype.isLineSegment = function () {
      return (
        Boolean(this.edge.id) && Boolean(this.edge.va) && Boolean(this.edge.vb)
      );
    };

    // Get starting point of the halfedge
    this.Halfedge.prototype.getStartpoint = function () {
      return this.edge.lSite.id === this.site.id ? this.edge.va : this.edge.vb;
    };

    // Get ending point of the halfedge
    this.Halfedge.prototype.getEndpoint = function () {
      return this.edge.lSite.id === this.site.id ? this.edge.vb : this.edge.va;
    };

    this.initCanvas();
  },

  /**
   * Epsilon-based comparison utilities to handle floating point precision.
   * These functions compare two numbers within a small margin of error (EPSILON).
   */
  EPSILON: 1e-4,

  /**
   * Checks if two values are equal within a small margin of error.
   * a - First value.
   * b - Second value.
   * returns True if values are approximately equal.
   */
  equalWithEpsilon: function (a, b) {
    return this.abs(a - b) < this.EPSILON;
  },

  /**
   * Determines if the first value is greater than the second, considering EPSILON.
   * a - First value.
   * b - Second value.
   * returns True if a is significantly greater than b.
   */
  greaterThanWithEpsilon: function (a, b) {
    return a - b > this.EPSILON;
  },

  /**
   * Determines if the first value is greater than or equal to the second, considering EPSILON.
   * a - First value.
   * b - Second value.
   * returns True if a is greater than or approximately equal to b.
   */
  greaterThanOrEqualWithEpsilon: function (a, b) {
    return b - a < this.EPSILON;
  },

  /**
   * Determines if the first value is less than the second, considering EPSILON.
   * a - First value.
   * b - Second value.
   * returns True if a is significantly less than b.
   */
  lessThanWithEpsilon: function (a, b) {
    return b - a > this.EPSILON;
  },

  /**
   * Determines if the first value is less than or equal to the second, considering EPSILON.
   * a - First value.
   * b - Second value.
   * returns True if a is less than or approximately equal to b.
   */
  lessThanOrEqualWithEpsilon: function (a, b) {
    return a - b < this.EPSILON;
  },

  /**
   * Clears all existing sites and resets the algorithm state.
   * Resets ID generators for Site and Edge objects.
   */
  clearSites: function () {
    this.sites = [];
    this.reset();
    this.Site.prototype.idgenerator = 1;
    this.Edge.prototype.idgenerator = 1;
  },

  /**
   * Adds a new site to the Voronoi diagram.
   * x - X-coordinate of the new site.
   * y - Y-coordinate of the new site.
   */
  addSite: function (x, y) {
    this.sites.push(new this.Site(x, y));
    this.reset();
    this.processQueueAll();
  },

  /**
   * Resets the state of the algorithm, clearing all processing metrics and queues.
   * Initializes the queue and redraws the current state.
   */
  reset: function () {
    this.NUM_SITES_PROCESSED = 0;
    this.BINARY_SEARCHES = 0;
    this.BINARY_SEARCH_ITERATIONS = 0;
    this.PARABOLIC_CUT_CALCS = 0;
    this.ALL_PARABOLIC_CUT_CALCS = 0;
    this.BEACHLINE_SIZE = 0;
    this.CIRCLE_QUEUE_SIZE = 0;
    this.LARGEST_CIRCLE_QUEUE_SIZE = 0;
    this.NUM_VOID_EVENTS = 0;
    this.NUM_CIRCLE_EVENTS = 0;
    this.TOTAL_NUM_EDGES = 0;
    this.NUM_DESTROYED_EDGES = 0;
    this.cellsClosed = false;
    this.queueInit();
    this.draw();
  },

  /**
   * Calculates the left break point of a specific beach section given the current sweep line.
   * iarc - Index of the beach section arc.
   * sweep - Current position of the sweep line.
   * returns X-coordinate of the left break point.
   */
  leftBreakPoint: function (iarc, sweep) {
    var arc = this.arcs[iarc];
    var site = arc.site;
    if (site.y === sweep) {
      return site.x;
    }
    if (iarc === 0) {
      return -Infinity;
    }
    return arc.leftParabolicCut(this.arcs[iarc - 1].site, sweep);
  },

  /**
   * Calculates the right break point of a specific beach section given the current sweep line.
   * iarc - Index of the beach section arc.
   * sweep - Current position of the sweep line.
   * returns X-coordinate of the right break point.
   */
  rightBreakPoint: function (iarc, sweep) {
    if (iarc < this.arcs.length - 1) {
      return this.leftBreakPoint(iarc + 1, sweep);
    }
    var site = this.arcs[iarc].site;
    return site.y === sweep ? site.x : Infinity;
  },

  /**
   * Finds the appropriate index to insert a new site into the beachline.
   * Utilizes a binary search approach to maintain beachline order.
   * x - X-coordinate of the new site.
   * sweep - Current position of the sweep line.
   * returns Index where the new site should be inserted.
   */
  findInsertionPoint: function (x, sweep) {
    this.BINARY_SEARCHES++;
    var n = this.arcs.length;
    if (!n) {
      return 0;
    }
    var left = 0;
    var right = n;
    var mid;
    while (left < right) {
      this.BINARY_SEARCH_ITERATIONS++;
      mid = Math.floor((left + right) / 2);
      if (this.lessThanWithEpsilon(x, this.leftBreakPoint(mid, sweep))) {
        right = mid;
        continue;
      }
      if (
        this.greaterThanOrEqualWithEpsilon(x, this.rightBreakPoint(mid, sweep))
      ) {
        left = mid + 1;
        continue;
      }
      return mid;
    }
    return left;
  },

  /**
   * Finds the deletion point for a given x-coordinate and sweep line position.
   * Utilizes a binary search to locate the appropriate beach section to remove.
   * x - The x-coordinate to search for.
   * sweep - The current position of the sweep line.
   * returns The index of the beach section to be deleted.
   */
  findDeletionPoint: function (x, sweep) {
    this.BINARY_SEARCHES++;
    var n = this.arcs.length;
    if (!n) {
      return 0;
    }
    var left = 0;
    var right = n;
    var mid;
    var xcut;
    while (left < right) {
      this.BINARY_SEARCH_ITERATIONS++;
      mid = Math.floor((left + right) / 2);
      xcut = this.leftBreakPoint(mid, sweep);
      if (this.lessThanWithEpsilon(x, xcut)) {
        right = mid;
        continue;
      }
      if (this.greaterThanWithEpsilon(x, xcut)) {
        left = mid + 1;
        continue;
      }
      xcut = this.rightBreakPoint(mid, sweep);
      if (this.greaterThanWithEpsilon(x, xcut)) {
        left = mid + 1;
        continue;
      }
      if (this.lessThanWithEpsilon(x, xcut)) {
        right = mid;
        continue;
      }
      return mid;
    }
  },

  /**
   * Creates and adds a new edge to the internal collection.
   * Additionally, it generates two halfedges and appends them to each site's
   * counterclockwise array of halfedges.
   * lSite - The left site associated with the edge.
   * rSite - The right site associated with the edge.
   * [va] - Optional starting vertex of the edge.
   * [vb] - Optional ending vertex of the edge.
   * returns The newly created edge.
   */
  createEdge: function (lSite, rSite, va, vb) {
    var edge = new this.Edge(lSite, rSite);
    this.edges.push(edge);
    if (va !== undefined) {
      this.setEdgeStartpoint(edge, lSite, rSite, va);
    }
    if (vb !== undefined) {
      this.setEdgeEndpoint(edge, lSite, rSite, vb);
    }
    // Add halfedges to each site's halfedge list
    this.cells[lSite.id].halfedges.push(new this.Halfedge(lSite, edge));
    this.cells[rSite.id].halfedges.push(new this.Halfedge(rSite, edge));
    return edge;
  },

  /**
   * Creates a border edge which extends to the borders of the canvas.
   * lSite - The site associated with the left side of the edge.
   * va - The starting vertex of the border edge.
   * vb - The ending vertex of the border edge.
   * returns The newly created border edge.
   */
  createBorderEdge: function (lSite, va, vb) {
    var edge = new this.Edge(lSite, null);
    edge.va = va;
    edge.vb = vb;
    this.edges.push(edge);
    return edge;
  },

  /**
   * Destroys an existing edge by nullifying its properties.
   * edge - The edge to be destroyed.
   */
  destroyEdge: function (edge) {
    edge.id = edge.va = edge.vb = undefined;
  },

  /**
   * Sets the starting point of an edge and associates it with the corresponding sites.
   * edge - The edge to update.
   * lSite - The left site associated with the edge.
   * rSite - The right site associated with the edge.
   * vertex - The vertex to set as the starting point.
   */
  setEdgeStartpoint: function (edge, lSite, rSite, vertex) {

    // Previously asserted that va and vb were not the same, but it's acceptable now
    if (edge.va === undefined && edge.vb === undefined) {
      edge.va = vertex;
      edge.lSite = lSite;
      edge.rSite = rSite;
    } else if (edge.lSite.id == rSite.id) {
      edge.vb = vertex;
    } else {
      edge.va = vertex;
    }
  },

  /**
   * Sets the endpoint of an edge by reusing the setEdgeStartpoint method.
   * edge - The edge to update.
   * lSite - The left site associated with the edge.
   * rSite - The right site associated with the edge.
   * vertex - The vertex to set as the endpoint.
   */
  setEdgeEndpoint: function (edge, lSite, rSite, vertex) {
    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
  },

  /**
   * Handles the deletion of an arc based on a circle event.
   * Removes the arc from the beachline, updates edges, and manages circle events.
   * event - The circle event triggering the arc removal.
   */
  removeArc: function (event) {
    var x = event.center.x;
    var y = event.center.y;
    var sweep = event.y;

    // Find the arc to be deleted
    var deletionPoint = this.findDeletionPoint(x, sweep);

    // Handle multiple collapsed arcs at the deletion point
    // by expanding to the left and right as necessary
    var iLeft = deletionPoint;
    while (
      iLeft - 1 > 0 &&
      this.equalWithEpsilon(x, this.leftBreakPoint(iLeft - 1, sweep))
    ) {
      iLeft--;
    }

    var iRight = deletionPoint;
    while (
      iRight + 1 < this.arcs.length &&
      this.equalWithEpsilon(x, this.rightBreakPoint(iRight + 1, sweep))
    ) {
      iRight++;
    }

    // Update edges by setting the start point of left and right arcs
    var lArc, rArc;
    for (var iArc = iLeft; iArc <= iRight + 1; iArc++) {
      lArc = this.arcs[iArc - 1];
      rArc = this.arcs[iArc];
      this.setEdgeStartpoint(
        rArc.edge,
        lArc.site,
        rArc.site,
        new this.Vertex(x, y)
      );
    }

    // Invalidate associated circle events
    this.voidCircleEvents(iLeft - 1, iRight + 1);

    // Remove the collapsed arcs from the beachline
    this.arcs.splice(iLeft, iRight - iLeft + 1);

    // Create a new edge between the new adjacent arcs
    lArc = this.arcs[iLeft - 1];
    rArc = this.arcs[iLeft];
    rArc.edge = this.createEdge(
      lArc.site,
      rArc.site,
      undefined,
      new this.Vertex(x, y)
    );

    // Add new circle events for the updated beachline
    this.addCircleEvents(iLeft - 1, sweep);
    this.addCircleEvents(iLeft, sweep);
  },

  /**
   * Adds a new arc to the beachline based on the provided site.
   * Determines the correct insertion point and updates edges and circle events accordingly.
   * site - The new site to add as an arc.
   */
  addArc: function (site) {
    // Create a new beach section for the site
    var newArc = new this.Beachsection(site);

    // Find the insertion point using binary search
    var insertionPoint = this.findInsertionPoint(site.x, site.y);

    // Handle the case where the new arc is added at the end of the beachline
    if (insertionPoint === this.arcs.length) {
      this.arcs.push(newArc);

      // If this is the first arc, no edges need to be created
      if (insertionPoint === 0) {
        return;
      }

      // Create a new edge between the last existing arc and the new arc
      newArc.edge = this.createEdge(
        this.arcs[insertionPoint - 1].site,
        newArc.site
      );
      return;
    }

    var lArc, rArc;

    // Handle insertion between two existing arcs
    if (
      insertionPoint > 0 &&
      this.equalWithEpsilon(
        site.x,
        this.rightBreakPoint(insertionPoint - 1, site.y)
      ) &&
      this.equalWithEpsilon(site.x, this.leftBreakPoint(insertionPoint, site.y))
    ) {
      lArc = this.arcs[insertionPoint - 1];
      rArc = this.arcs[insertionPoint];

      // Invalidate existing circle events for affected arcs
      this.voidCircleEvents(insertionPoint - 1, insertionPoint);

      // Calculate the circumcircle for the triplet of arcs
      var circle = this.circumcircle(lArc.site, site, rArc.site);
      this.setEdgeStartpoint(
        rArc.edge,
        lArc.site,
        rArc.site,
        new this.Vertex(circle.x, circle.y)
      );

      // Create two new edges for the new transitions
      newArc.edge = this.createEdge(
        lArc.site,
        newArc.site,
        undefined,
        new this.Vertex(circle.x, circle.y)
      );
      rArc.edge = this.createEdge(
        newArc.site,
        rArc.site,
        undefined,
        new this.Vertex(circle.x, circle.y)
      );

      // Insert the new beach section into the beachline
      this.arcs.splice(insertionPoint, 0, newArc);

      // Add new circle events for the updated beachline
      this.addCircleEvents(insertionPoint - 1, site.y);
      this.addCircleEvents(insertionPoint + 1, site.y);

      return;
    }

    // Handle the typical case where an existing arc is split by the new arc
    // Invalidate the circle event for the arc being split
    this.voidCircleEvents(insertionPoint);

    // Retrieve the arc to the left of the insertion point
    lArc = this.arcs[insertionPoint];

    // Create a new beach section and corresponding arc
    var rArc = new this.Beachsection(lArc.site);
    this.arcs.splice(insertionPoint + 1, 0, newArc, rArc);

    // Create a new edge between the left arc and the new arc
    newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

    // Add circle events for the newly created arcs
    this.addCircleEvents(insertionPoint, site.y);
    this.addCircleEvents(insertionPoint + 2, site.y);
  },

  /**
   * Calculates the circumcircle of three points.
   * a - First point with x and y coordinates.
   * b - Second point with x and y coordinates.
   * c - Third point with x and y coordinates.
   * returns The circumcircle with center coordinates and radius.
   */
  circumcircle: function (a, b, c) {
    var ax = a.x;
    var ay = a.y;
    var bx = b.x - ax;
    var by = b.y - ay;
    var cx = c.x - ax;
    var cy = c.y - ay;
    var d = 2 * (bx * cy - by * cx);
    var hb = bx * bx + by * by;
    var hc = cx * cx + cy * cy;
    var x = (cy * hb - by * hc) / d;
    var y = (bx * hc - cx * hb) / d;
    return { x: x + ax, y: y + ay, radius: this.sqrt(x * x + y * y) };
  },

  /**
   * Adds circle events based on the current beachline.
   * Determines if three consecutive arcs form a valid circle event and queues it.
   * iArc - Index of the central arc in the triplet.
   * sweep - Current position of the sweep line.
   */
  addCircleEvents: function (iArc, sweep) {
    // Ensure there are enough arcs to form a triplet
    if (iArc <= 0 || iArc >= this.arcs.length - 1) {
      return;
    }

    var arc = this.arcs[iArc];
    var lSite = this.arcs[iArc - 1].site;
    var cSite = this.arcs[iArc].site;
    var rSite = this.arcs[iArc + 1].site;

    // Avoid degenerate cases where sites are duplicated
    if (
      lSite.id === rSite.id ||
      lSite.id === cSite.id ||
      cSite.id === rSite.id
    ) {
      return;
    }

    // Check the orientation to determine if a circle event is possible
    if (
      (lSite.y - cSite.y) * (rSite.x - cSite.x) <=
      (lSite.x - cSite.x) * (rSite.y - cSite.y)
    ) {
      return;
    }

    // Calculate the circumcircle of the triplet
    var circle = this.circumcircle(lSite, cSite, rSite);

    // Ensure the circle's bottom is below the sweep line
    var ybottom = circle.y + circle.radius;
    if (!this.greaterThanOrEqualWithEpsilon(ybottom, sweep)) {
      return;
    }

    // Create and queue the circle event
    var circEvent = {
      type: this.CIRCLE_EVENT,
      site: cSite,
      x: circle.x,
      y: ybottom,
      center: { x: circle.x, y: circle.y },
    };
    arc.circleEvent = circEvent;
    this.queuePushCircle(circEvent);
  },

  /**
   * Invalidates circle events within a specified range of arcs.
   * Marks the events as void to prevent them from being processed.
   * iLeft - Left index of the range.
   * [iRight=iLeft] - Right index of the range (optional).
   */
  voidCircleEvents: function (iLeft, iRight) {
    if (iRight === undefined) {
      iRight = iLeft;
    }
    iLeft = this.max(iLeft, 0);
    iRight = this.min(iRight, this.arcs.length - 1);

    while (iLeft <= iRight) {
      var arc = this.arcs[iLeft];
      if (arc.circleEvent !== undefined) {
        arc.circleEvent.type = this.VOID_EVENT;
        // Efficiently remove the circle event reference
        arc.circleEvent = undefined;
      }
      iLeft++;
    }
  },

  /**
   * Initializes the event queue with site and circle events.
   * Resets all relevant data structures and prepares the beachline.
   */
  queueInit: function () {
    this.sweep = 0;
    this.siteEvents = [];
    var n = this.sites.length;

    // Queue all site events
    for (var i = 0; i < n; i++) {
      var site = this.sites[i];
      this.queuePushSite({
        type: this.SITE_EVENT,
        x: site.x,
        y: site.y,
        site: site,
      });
    }

    this.NUM_SITES_PROCESSED = this.siteEvents.length;
    this.circEvents = [];
    this.arcs = [];
    this.edges = [];
    this.cells = {};
  },

  /**
   * Removes void events from the circle events queue to optimize performance.
   * Ensures that the queue doesn't accumulate unnecessary events, improving insertion efficiency.
   * Cleans up trailing void events and, if the queue exceeds twice the number of arcs, removes all void events.
   */
  queueSanitize: function () {

    var q = this.circEvents;
    var iRight = q.length;
    if (!iRight) {
      return;
    }

    // Remove trailing void events only
    var iLeft = iRight;
    while (iLeft && q[iLeft - 1].type === this.VOID_EVENT) {
      iLeft--;
    }
    var nEvents = iRight - iLeft;
    if (nEvents) {
      this.NUM_VOID_EVENTS += nEvents;
      q.splice(iLeft, nEvents);
    }

    // Remove all void events if queue grew too large
    var nArcs = this.arcs.length;
    if (q.length < nArcs * 2) {
      return;
    }
    while (true) {
      iRight = iLeft - 1;
      // Find the right-most void event
      while (iRight > 0 && q[iRight - 1].type !== this.VOID_EVENT) {
        iRight--;
      }
      if (iRight <= 0) {
        break;
      }
      // Find the right-most non-void event immediately to the left of iRight
      iLeft = iRight - 1;
      while (iLeft > 0 && q[iLeft - 1].type === this.VOID_EVENT) {
        iLeft--;
      }
      nEvents = iRight - iLeft;
      this.NUM_VOID_EVENTS += nEvents;
      q.splice(iLeft, nEvents);
      // Abort if queue has gotten small enough to avoid full traversal
      if (q.length < nArcs) {
        return;
      }
    }
  },

  /**
   * Checks if the event queue is empty after sanitation.
   * returns True if both siteEvents and circEvents queues are empty.
   */
  queueIsEmpty: function () {
    this.queueSanitize();
    return this.siteEvents.length === 0 && this.circEvents.length === 0;
  },

  /**
   * Retrieves the next event from the priority queues without removing it.
   * Determines the earliest event between site events and circle events.
   * returns The earliest event or null if both queues are empty.
   */
  queuePeek: function () {
    this.queueSanitize();
    var siteEvent =
      this.siteEvents.length > 0
        ? this.siteEvents[this.siteEvents.length - 1]
        : null;
    var circEvent =
      this.circEvents.length > 0
        ? this.circEvents[this.circEvents.length - 1]
        : null;

    // If only one type of event exists, return it
    if (Boolean(siteEvent) !== Boolean(circEvent)) {
      return siteEvent ? siteEvent : circEvent;
    }

    // If both queues are empty
    if (!siteEvent) {
      return null;
    }

    // If both queues have events, return the earliest
    if (
      siteEvent.y < circEvent.y ||
      (siteEvent.y === circEvent.y && siteEvent.x < circEvent.x)
    ) {
      return siteEvent;
    }
    return circEvent;
  },

  /**
   * Removes and returns the next event from the priority queues.
   * returns The removed event or null if queues are empty.
   */
  queuePop: function () {
    var event = this.queuePeek();
    if (event) {
      if (event.type === this.SITE_EVENT) {
        this.siteEvents.pop();
      } else {
        this.circEvents.pop();
      }
    }
    return event;
  },

  /**
   * Inserts a site event into the siteEvents queue in sorted order.
   * o - The site event object to be inserted.
   */
  queuePushSite: function (o) {
    var q = this.siteEvents;
    var r = q.length;
    if (r) {
      var l = 0;
      var i, c;
      while (l < r) {
        i = (l + r) >> 1;
        c = o.y - q[i].y;
        if (!c) {
          c = o.x - q[i].x;
        }
        if (c > 0) {
          r = i;
        } else if (c < 0) {
          l = i + 1;
        } else {
          return; /* Duplicate sites not allowed */
        }
      }
      q.splice(l, 0, o);
    } else {
      q.push(o);
    }
  },

  /**
   * Inserts a circle event into the circEvents queue in sorted order.
   * o - The circle event object to be inserted.
   */
  queuePushCircle: function (o) {
    this.NUM_CIRCLE_EVENTS++;
    var q = this.circEvents;
    var r = q.length;
    if (r) {
      var l = 0;
      var i, c;
      while (l < r) {
        i = (l + r) >> 1;
        c = o.y - q[i].y;
        if (!c) {
          c = o.x - q[i].x;
        }
        if (c > 0) {
          r = i;
        } else {
          l = i + 1;
        }
      }
      q.splice(l, 0, o);
    } else {
      q.push(o);
    }
  },

  /**
   * Processes the next event in the event queue.
   * Handles either a site event by adding a new arc or a circle event by removing an arc.
   * After processing, it checks if all cells should be closed.
   */
  processQueueOne: function () {
    var event = this.queuePop();
    if (!event) {
      return;
    }
    this.sweep = event.y;

    if (event.type === this.SITE_EVENT) {
      // Initialize a new cell for the site if it hasn't been created yet
      this.cells[event.site.id] = new this.Cell(event.site);

      // Add a new beach section (arc) for the site
      this.addArc(event.site);

      // Update performance metrics
      this.BEACHLINE_SIZE += this.arcs.length;
      this.CIRCLE_QUEUE_SIZE += this.circEvents.length;
      this.LARGEST_CIRCLE_QUEUE_SIZE = this.max(
        this.circEvents.length,
        this.LARGEST_CIRCLE_QUEUE_SIZE
      );
    } else {
      // Handle a circle event by removing the corresponding arc
      this.removeArc(event);
    }

    // If the event queue is empty, finalize the diagram by closing all cells
    if (this.queueIsEmpty()) {
      this.closeCells();
    }
  },

  /**
   * Processes up to 'n' events from the event queue.
   * Continues processing until 'n' events have been handled or the queue is empty.
   * If the queue becomes empty, updates the sweep line position to the bottom of the canvas.
   * n - The maximum number of events to process.
   */
  processQueueN: function (n) {
    while (n > 0 && !this.queueIsEmpty()) {
      this.processQueueOne();
      n -= 1;
    }
    if (this.queueIsEmpty()) {
      this.sweep = this.max(this.sweep, this.canvas.height);
    }
  },

  /**
   * Processes all remaining events in the event queue.
   * Updates the sweep line position, dumps the current beachline state, and redraws the diagram.
   */
  processQueueAll: function () {
    this.processQueueN(999999999); // Effectively process all events
    this.sweep = this.max(this.sweep, this.canvas.height);
    this.draw();
  },

  /**
   * Processes all events in the queue up to a specified y-coordinate.
   * Stops processing when the next event is above the given y-coordinate.
   * Ensures the sweep line does not move backward and finalizes the diagram if the sweep line exceeds the canvas height.
   * y - The y-coordinate up to which events should be processed.
   */
  processUpTo: function (y) {
    var event;
    while (!this.queueIsEmpty()) {
      event = this.queuePeek();
      if (event.y > y) {
        break;
      }
      this.processQueueOne();
    }
    // Ensure the sweep line moves forward
    this.sweep = this.max(this.sweep, y);

    // Finalize the diagram if the sweep line goes beyond the canvas
    if (this.sweep > this.canvas.height) {
      this.processQueueN(999999999); // Process remaining events
    }
  },

  /**
   * Calculates the bisector (perpendicular bisector) between two vertices.
   * Determines the line that divides the segment connecting two points into two equal parts at a right angle.
   * va - The first vertex with properties x and y.
   * vb - The second vertex with properties x and y.
   */
  getBisector: function (va, vb) {
    var midpoint = { x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2 };

    if (vb.y === va.y) {
      // Horizontal line segment results in a vertical bisector
      return midpoint;
    }

    // Calculate the slope (m) of the perpendicular bisector
    midpoint.m = (va.x - vb.x) / (vb.y - va.y);
    // Calculate the y-intercept (b) of the bisector
    midpoint.b = midpoint.y - midpoint.m * midpoint.x;

    return midpoint;
  },

  /**
   * Connects a dangling edge to the bounding box or removes it if it cannot be connected.
   * Determines the appropriate side of the bounding box to extend the edge based on its direction.
   * edge - The edge to be connected.
   * returns True if the edge was successfully connected, false otherwise.
   */
  connectEdge: function (edge) {
    var vb = edge.vb;
    if (vb) {
      return true;
    } // Edge is already connected

    var va = edge.va;
    var xl = this.bbox.xl;
    var xr = this.bbox.xr;
    var yt = this.bbox.yt;
    var yb = this.bbox.yb;

    // Get the bisector line between the two sites of the edge
    var lSite = edge.lSite;
    var rSite = edge.rSite;
    var bisector = this.getBisector(lSite, rSite);

    /**
     * Determine the orientation of the bisector to decide which side of the bounding box to connect.
     * Cases:
     * - Vertical bisector
     * - Bisector closer to horizontal
     * - Bisector closer to vertical
     */

    // Special case: Vertical bisector (undefined slope)
    if (bisector.m === undefined) {
      // Ensure the bisector intersects within the bounding box horizontally
      if (bisector.x < xl || bisector.x >= xr) {
        return false;
      }

      if (lSite.x > rSite.x) {
        // Downward direction
        if (va === undefined) {
          va = new this.Vertex(bisector.x, yt);
        } else if (va.y >= yb) {
          return false;
        }
        vb = new this.Vertex(bisector.x, yb);
      } else {
        // Upward direction
        if (va === undefined) {
          va = new this.Vertex(bisector.x, yb);
        } else if (va.y < yt) {
          return false;
        }
        vb = new this.Vertex(bisector.x, yt);
      }
    }
    // Bisector is closer to horizontal
    else if (bisector.m < 1) {
      if (lSite.y < rSite.y) {
        // Rightward direction
        if (va === undefined) {
          va = new this.Vertex(xl, bisector.m * xl + bisector.b);
        } else if (va.x >= xr) {
          return false;
        }
        vb = new this.Vertex(xr, bisector.m * xr + bisector.b);
      } else {
        // Leftward direction
        if (va === undefined) {
          va = new this.Vertex(xr, bisector.m * xr + bisector.b);
        } else if (va.x < xl) {
          return false;
        }
        vb = new this.Vertex(xl, bisector.m * xl + bisector.b);
      }
    }
    // Bisector is closer to vertical
    else {
      if (lSite.x > rSite.x) {
        // Downward direction
        if (va === undefined) {
          va = new this.Vertex((yt - bisector.b) / bisector.m, yt);
        } else if (va.y >= yb) {
          return false;
        }
        vb = new this.Vertex((yb - bisector.b) / bisector.m, yb);
      } else {
        // Upward direction
        if (va === undefined) {
          va = new this.Vertex((yb - bisector.b) / bisector.m, yb);
        } else if (va.y < yt) {
          return false;
        }
        vb = new this.Vertex((yt - bisector.b) / bisector.m, yt);
      }
    }

    edge.va = va;
    edge.vb = vb;
    return true;
  },

  /**
   * Clips an edge to the bounding box using the Liang-Barsky algorithm.
   * Determines the portion of the edge that lies within the bounding box.
   * edge - The edge to be clipped, containing vertices va and vb.
   * returns True if the edge intersects the bounding box, false otherwise.
   */
  clipEdge: function (edge) {

    var ax = edge.va.x;
    var ay = edge.va.y;
    var bx = edge.vb.x;
    var by = edge.vb.y;
    var t0 = 0;
    var t1 = 1;
    var dx = bx - ax;
    var dy = by - ay;

    // Define the clipping boundaries
    // Left boundary
    var q = ax - this.bbox.xl;
    if (dx === 0 && q < 0) {
      return false;
    }
    var r = -q / dx;
    if (dx < 0) {
      if (r < t0) {
        return false;
      } else if (r < t1) {
        t1 = r;
      }
    } else if (dx > 0) {
      if (r > t1) {
        return false;
      } else if (r > t0) {
        t0 = r;
      }
    }

    // Right boundary
    q = this.bbox.xr - ax;
    if (dx === 0 && q < 0) {
      return false;
    }
    r = q / dx;
    if (dx < 0) {
      if (r > t1) {
        return false;
      } else if (r > t0) {
        t0 = r;
      }
    } else if (dx > 0) {
      if (r < t0) {
        return false;
      } else if (r < t1) {
        t1 = r;
      }
    }

    // Top boundary
    q = ay - this.bbox.yt;
    if (dy === 0 && q < 0) {
      return false;
    }
    r = -q / dy;
    if (dy < 0) {
      if (r < t0) {
        return false;
      } else if (r < t1) {
        t1 = r;
      }
    } else if (dy > 0) {
      if (r > t1) {
        return false;
      } else if (r > t0) {
        t0 = r;
      }
    }

    // Bottom boundary
    q = this.bbox.yb - ay;
    if (dy === 0 && q < 0) {
      return false;
    }
    r = q / dy;
    if (dy < 0) {
      if (r > t1) {
        return false;
      } else if (r > t0) {
        t0 = r;
      }
    } else if (dy > 0) {
      if (r < t0) {
        return false;
      } else if (r < t1) {
        t1 = r;
      }
    }

    // Update the edge vertices to the clipped coordinates
    edge.va.x = ax + t0 * dx;
    edge.va.y = ay + t0 * dy;
    edge.vb.x = ax + t1 * dx;
    edge.vb.y = ay + t1 * dy;

    return true;
  },

  /**
   * Clips all edges to the bounding box and removes any edges that cannot be properly clipped.
   * Iterates through all edges, connects dangling edges, clips them, and removes invalid edges.
   */
  clipEdges: function () {
    var edges = this.edges;
    var nEdges = (this.TOTAL_NUM_EDGES = edges.length);
    var edge;

    // Iterate backwards to safely remove edges while iterating
    for (var iEdge = nEdges - 1; iEdge >= 0; iEdge--) {
      edge = edges[iEdge];
      // Attempt to connect and clip the edge; remove if unsuccessful or if vertices are equal
      if (
        !this.connectEdge(edge) ||
        !this.clipEdge(edge) ||
        this.verticesAreEqual(edge.va, edge.vb)
      ) {
        this.NUM_DESTROYED_EDGES++;
        this.destroyEdge(edge);
        edges.splice(iEdge, 1);
      }
    }
  },

  /**
   * Determines if two vertices are equal within a specified epsilon.
   * a - The first vertex with properties x and y.
   * b - The second vertex with properties x and y.
   * returns True if both vertices are equal within epsilon, false otherwise.
   */
  verticesAreEqual: function (a, b) {
    return this.equalWithEpsilon(a.x, b.x) && this.equalWithEpsilon(a.y, b.y);
  },

  /**
   * Comparator function to sort halfedges in counterclockwise order based on their angles.
   * a - The first halfedge to compare.
   * b - The second halfedge to compare.
   * returns Negative if a < b, positive if a > b, zero if equal.
   */
  sortHalfedgesCallback: function (a, b) {
    var ava = a.getStartpoint();
    var avb = a.getEndpoint();
    var bva = b.getStartpoint();
    var bvb = b.getEndpoint();

    // Calculate angles using atan2 and sort based on the difference
    return (
      self.Math.atan2(bvb.y - bva.y, bvb.x - bva.x) -
      self.Math.atan2(avb.y - ava.y, avb.x - ava.x)
    );
  },

  /**
   * Finalizes all cells by closing their boundaries within the bounding box.
   * Processes each cell to ensure it is properly bounded and removes any incomplete or invalid cells.
   */
  closeCells: function () {
    if (this.cellsClosed) {
      return;
    }

    var xl = this.bbox.xl;
    var xr = this.bbox.xr;
    var yt = this.bbox.yt;
    var yb = this.bbox.yb;

    // Clip all edges to ensure they lie within the bounding box
    this.clipEdges();

    var cells = this.cells;
    var cell;
    var iLeft, iRight;
    var halfedges, nHalfedges;
    var edge;
    var startpoint, endpoint;
    var va, vb;

    for (var cellid in cells) {
      cell = cells[cellid];
      halfedges = cell.halfedges;
      iLeft = halfedges.length;

      // Remove unused halfedges (those representing line segments)
      while (iLeft) {
        iRight = iLeft;
        while (iRight > 0 && halfedges[iRight - 1].isLineSegment()) {
          iRight--;
        }
        iLeft = iRight;
        while (iLeft > 0 && !halfedges[iLeft - 1].isLineSegment()) {
          iLeft--;
        }
        if (iLeft === iRight) {
          break;
        }
        halfedges.splice(iLeft, iRight - iLeft);
      }

      // Delete the cell if it has no remaining halfedges
      if (halfedges.length === 0) {
        delete cells[cellid];
        continue;
      }

      // Sort the halfedges in counterclockwise order
      halfedges.sort(this.sortHalfedgesCallback);

      // Iterate through halfedges to close any open boundaries
      nHalfedges = halfedges.length;
      iLeft = 0;
      while (iLeft < nHalfedges) {
        iRight = (iLeft + 1) % nHalfedges;
        endpoint = halfedges[iLeft].getEndpoint();
        startpoint = halfedges[iRight].getStartpoint();

        // Check if the current halfedge endpoint matches the next halfedge startpoint
        if (!this.verticesAreEqual(endpoint, startpoint)) {
          // Create a vertex to close the gap by extending to the bounding box
          va = new this.Vertex(endpoint.x, endpoint.y);

          // Determine the direction to extend based on the endpoint's position
          if (
            this.equalWithEpsilon(endpoint.x, xl) &&
            this.lessThanWithEpsilon(endpoint.y, yb)
          ) {
            // Extend downward along the left side
            vb = new this.Vertex(
              xl,
              this.equalWithEpsilon(startpoint.x, xl) ? startpoint.y : yb
            );
          } else if (
            this.equalWithEpsilon(endpoint.y, yb) &&
            this.lessThanWithEpsilon(endpoint.x, xr)
          ) {
            // Extend rightward along the bottom side
            vb = new this.Vertex(
              this.equalWithEpsilon(startpoint.y, yb) ? startpoint.x : xr,
              yb
            );
          } else if (
            this.equalWithEpsilon(endpoint.x, xr) &&
            this.greaterThanWithEpsilon(endpoint.y, yt)
          ) {
            // Extend upward along the right side
            vb = new this.Vertex(
              xr,
              this.equalWithEpsilon(startpoint.x, xr) ? startpoint.y : yt
            );
          } else if (
            this.equalWithEpsilon(endpoint.y, yt) &&
            this.greaterThanWithEpsilon(endpoint.x, xl)
          ) {
            // Extend leftward along the top side
            vb = new this.Vertex(
              this.equalWithEpsilon(startpoint.y, yt) ? startpoint.x : xl,
              yt
            );
          }

          // Create a border edge to close the cell
          edge = this.createBorderEdge(cell.site, va, vb);

          // Insert the new halfedge into the cell's halfedges list
          halfedges.splice(iLeft + 1, 0, new this.Halfedge(cell.site, edge));
          nHalfedges = halfedges.length;
        }
        iLeft++;
      }
    }

    this.cellsClosed = true;
  },

  /**
   * Initializes the canvas for drawing the Voronoi diagram.
   * Sets up the canvas context, dimensions, and initial styles.
   */
  initCanvas: function () {
    if (this.canvas) {
      return;
    }

    var canvas = document.getElementById("voronoiCanvas");
    if (!canvas.getContext) {
      return;
    }

    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Set canvas dimensions to default values
    canvas.width = this.DEFAULT_CANVAS_WIDTH;
    canvas.height = this.DEFAULT_CANVAS_HEIGHT;

    // Fill the canvas with a white background
    ctx.fillStyle = "#fff";
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();

    // Set stroke style for the canvas border
    ctx.strokeStyle = "#888";
    ctx.stroke();

    this.canvas = canvas;
  },

  /**
   * Draws the entire Voronoi diagram on the canvas.
   * Includes background, sites, edges, vertices, and the sweep line.
   */
  draw: function () {
    var ctx = this.canvas.getContext("2d");

    // Draw the background of the canvas
    this.drawBackground(ctx);

    // Draw all the sites (points) on the canvas
    this.drawSites(ctx);

    // Draw the sweep line if it's within the canvas height
    if (this.sweep < this.canvas.height) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#00f";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, this.sweep);
      ctx.lineTo(this.canvas.width, this.sweep);
      ctx.stroke();
    }

    // Draw all the edges of the Voronoi diagram
    this.drawEdges(ctx);

    // If there are events in the queue, draw the vertices
    if (!this.queueIsEmpty()) {
      this.drawVertices(ctx);
    }

    // Draw the beachline if the sweep line is still moving
    if (this.sweep < this.canvas.height) {
      this.drawBeachline(ctx);
    }
  },

  /**
   * Draws the background of the canvas.
   * Fills the canvas with a white rectangle and outlines it.
   * ctx - The canvas rendering context.
   */
  drawBackground: function (ctx) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.strokeStyle = "#888";
    ctx.stroke();
  },

  /**
   * Draws all the sites (points) on the canvas.
   * Sites are represented as small rectangles, size varies based on the event queue state.
   * ctx - The canvas rendering context.
   */
  drawSites: function (ctx) {
    var queueIsEmpty = this.queueIsEmpty();
    ctx.beginPath();
    var nSites = this.sites.length;

    for (var iSite = 0; iSite < nSites; iSite++) {
      var site = this.sites[iSite];

      // Adjust the size of the site marker based on whether the event queue is empty
      if (queueIsEmpty) {
        ctx.rect(site.x - 0.25, site.y - 0.25, 1.5, 1.5);
      } else {
        ctx.rect(site.x - 0.5, site.y - 0.5, 2, 2);
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fill();
  },

  /**
   * Draws the beachline on the canvas, representing the current state of the Voronoi diagram.
   * The beachline consists of parabolic arcs corresponding to the active sites.
   * ctx - The canvas rendering context.
   */
  drawBeachline: function (ctx) {
    // Exit if there are no beach sections to draw
    var nArcs = this.arcs.length;
    if (!nArcs) {
      return;
    }

    // Set up drawing parameters
    var cw = this.canvas.width;
    ctx.lineWidth = 1;
    var directrix = this.sweep; // The sweep line acts as the directrix for parabolas

    // Initialize the first arc
    var arc = this.arcs[0];
    var xl = 0;
    var yl, xr, yr;
    var focx = arc.site.x;
    var focy = arc.site.y;
    var p;

    // Determine the initial y-coordinate based on the position of the focus relative to the directrix
    if (focy == directrix) {
      xl = focx;
      yl = 0;
    } else {
      p = (focy - directrix) / 2;
      yl = (focx * focx) / (4 * p) + focy - p;
    }

    // Iterate through each beach section (arc)
    var neighbour, ac_x, ac_y, bc_x, bc_y, gx, gy, n;
    var pi_by_2 = this.PI * 2;

    for (var iArc = 0; iArc < nArcs; iArc++) {
      arc = this.arcs[iArc];
      focx = arc.site.x;
      focy = arc.site.y;

      // Draw associated circle event if the arc is collapsing
      if (arc.isCollapsing()) {
        var circEvent = arc.circleEvent;
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#800";
        ctx.fillRect(circEvent.center.x - 0.5, circEvent.center.y - 0.5, 2, 2);

        ctx.beginPath();
        ctx.arc(
          circEvent.center.x,
          circEvent.center.y,
          circEvent.y - circEvent.center.y,
          0,
          pi_by_2,
          true
        );
        ctx.strokeStyle = "#aaa";
        ctx.stroke();

        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.fillRect(circEvent.x - 0.5, circEvent.y - 0.5, 2, 2);
        ctx.restore();
      }

      // Handle degenerate case where the focus is on the directrix (parabola becomes a vertical line)
      if (focy == directrix) {
        xr = focx;
        neighbour = iArc > 0 ? this.arcs[iArc - 1] : null;

        // Check if the left neighbour is also degenerate
        if (!neighbour || neighbour.site.y == directrix) {
          neighbour = iArc < this.arcs.length - 1 ? this.arcs[iArc + 1] : null;
        }

        // If both neighbours are degenerate, terminate at the top of the bounding box
        if (!neighbour || neighbour.site.y == directrix) {
          yr = 0;
        } else {
          // Calculate the y-coordinate using the quadratic equation
          p = (neighbour.site.y - directrix) / 2;
          yr =
            this.pow(focx - neighbour.site.x, 2) / (4 * p) +
            neighbour.site.y -
            p;
        }

        // Draw the vertical line segment
        ctx.strokeStyle = "#080";
        ctx.beginPath();
        ctx.moveTo(focx, focy);
        ctx.lineTo(focx, yr);
        ctx.stroke();

        // Update the left cut coordinates for the next iteration
        xl = xr;
        yl = yr;
        continue;
      }

      // Calculate the right breakpoint, ensuring it doesn't exceed the canvas width
      xr = this.min(this.rightBreakPoint(iArc, directrix), cw);
      p = (focy - directrix) / 2;
      yr = this.pow(xr - focx, 2) / (4 * p) + focy - p;

      // Draw the parabola segment only if it's within the visible area
      if (xr >= 0 && xl < cw && xr > xl) {
        ctx.strokeStyle = arc.isCollapsing() ? "#800" : "#080";

        // Calculate control points for the quadratic curve
        ac_x = focx - xl;
        ac_y = focy - directrix;
        bc_x = focx - xr;
        bc_y = focy - directrix;
        gx = (xr + focx) / 2;
        gy = (directrix + focy) / 2;
        n =
          ((gx - (xl + focx) / 2) * ac_x +
            (gy - (directrix + focy) / 2) * ac_y) /
          (bc_y * ac_x - bc_x * ac_y);

        // Draw the quadratic curve representing the parabola segment
        ctx.beginPath();
        ctx.moveTo(xl, yl);
        ctx.quadraticCurveTo(gx - bc_y * n, gy + bc_x * n, xr, yr);
        ctx.stroke();
      }

      // Update the left cut coordinates for the next iteration
      xl = xr;
      yl = yr;
    }
  },

  /**
   * Draws all vertices (endpoints) of the edges on the canvas.
   * Each vertex is represented as a small rectangle.
   * ctx - The canvas rendering context.
   */
  drawVertices: function (ctx) {
    ctx.beginPath();
    ctx.globalAlpha = 1;
    var nEdges = this.edges.length;
    var edge;
    var va, vb;

    for (var iEdge = 0; iEdge < nEdges; iEdge++) {
      edge = this.edges[iEdge];
      va = edge.va;
      if (va !== undefined) {
        ctx.rect(va.x - 0.75, va.y - 0.75, 2.5, 2.5);
      }
      vb = edge.vb;
      if (vb !== undefined) {
        ctx.rect(vb.x - 0.75, vb.y - 0.75, 2.5, 2.5);
      }
    }

    ctx.fillStyle = "#07f";
    ctx.fill();
  },

  /**
   * Draws all edges of the Voronoi diagram on the canvas.
   * Each edge is a line between two defined vertices.
   * ctx - The canvas rendering context.
   */
  drawEdges: function (ctx) {
    ctx.beginPath();
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 1;
    var nEdges = this.edges.length;
    var edge;
    var va, vb;

    for (var iEdge = 0; iEdge < nEdges; iEdge++) {
      edge = this.edges[iEdge];
      // Skip edges with undefined vertices
      if (edge.va === undefined || edge.vb === undefined) {
        continue;
      }

      va = edge.va;
      vb = edge.vb;
      ctx.moveTo(va.x, va.y);
      ctx.lineTo(vb.x, vb.y);
    }

    ctx.strokeStyle = "#000";
    ctx.stroke();
  },
};

// Animation control variables
var voronoiAnimateTimer;
var voronoiAnimatePixels;
var voronoiAnimateDelay;

/**
 * Callback function for animating the Voronoi diagram.
 * Processes events, redraws the canvas, and schedules the next animation frame.
 */
function voronoiAnimateCallback() {
  voronoiAnimateTimer = undefined;
  voronoi.processUpTo(voronoi.sweep + voronoiAnimatePixels);
  voronoi.draw();

  if (!voronoi.queueIsEmpty() || voronoi.sweep < voronoi.bbox.yb) {
    voronoiAnimateTimer = setTimeout(
      voronoiAnimateCallback,
      voronoiAnimateDelay
    );
  }
}

/**
 * Starts the animation of the Voronoi diagram.
 * px - Number of pixels to move the sweep line each step.
 * ms - Delay in milliseconds between each animation step.
 */
function voronoiAnimate(px, ms) {
  if (voronoiAnimateTimer !== undefined) {
    clearTimeout(voronoiAnimateTimer);
    voronoiAnimateTimer = undefined;
  }

  if (voronoi.queueIsEmpty()) {
    voronoi.reset();
  }

  voronoiAnimatePixels = isNaN(px) ? 5 : Math.max(px, 1);
  voronoiAnimateDelay = isNaN(ms) ? 200 : Math.max(ms, 1);

  voronoiAnimateTimer = setTimeout(voronoiAnimateCallback, voronoiAnimateDelay);
}
