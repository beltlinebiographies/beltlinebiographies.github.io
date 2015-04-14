/* jshint ignore:start */

/* jshint ignore:end */

define('historic-locations/adapters/application', ['exports', 'ember-data'], function (exports, DS) {

	'use strict';

	exports['default'] = DS['default'].FixtureAdapter.extend();

});
define('historic-locations/app', ['exports', 'ember', 'ember/resolver', 'ember/load-initializers', 'historic-locations/config/environment'], function (exports, Ember, Resolver, loadInitializers, config) {

  'use strict';

  Ember['default'].MODEL_FACTORY_INJECTIONS = true;

  var App = Ember['default'].Application.extend({
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix,
    Resolver: Resolver['default']
  });

  loadInitializers['default'](App, config['default'].modulePrefix);

  exports['default'] = App;

});
define('historic-locations/components/google-map', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["google-map"],

    buildMap: (function () {
      var mapOptions = {
        zoom: 14,
        center: new google.maps.LatLng(33.76743, -84.360744)
      };

      var elementId = document.getElementById(this.get("elementId"));
      var map = new google.maps.Map(elementId, mapOptions);
      this.set("map", map);
      this.addMarkers();
    }).on("didInsertElement"),

    addMarkers: function addMarkers() {
      var map = this.get("map");
      var markers = [];
      var _this = this;
      this.get("locations").forEach(function (location) {
        var myLatlng = new google.maps.LatLng(location.get("latitude"), location.get("longitude"));
        var marker = new google.maps.Marker({
          position: myLatlng,
          map: map,
          title: location.get("title")
        });

        google.maps.event.addListener(marker, "click", function () {
          _this.sendAction("onMarkerClick", location.get("id"));
        });
        markers.pushObject(marker);
      });
      this.currentLocation();
      this.set("markers", markers);
    },

    currentLocation: function currentLocation() {
      var component = this;
      if ("geolocation" in navigator) {
        var geo_success = function (position) {
          var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
          var marker = new google.maps.Marker({
            position: latlng,
            map: component.get("map")
          });
          component.set("currentMarker", marker);
        };

        var geo_error = function () {
          alert("Sorry, no position available.");
        };

        var geo_options = {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        };

        var wpid = navigator.geolocation.watchPosition(geo_success, geo_error, geo_options);
      } else {
        console.log("This is not going to work well without giving your location.");
      }
    }
  });

});
define('historic-locations/components/lf-outlet', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.StaticOutlet;

});
define('historic-locations/components/lf-overlay', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var COUNTER = "__lf-modal-open-counter";

  exports['default'] = Ember['default'].Component.extend({
    tagName: "span",
    classNames: ["lf-overlay"],

    didInsertElement: function didInsertElement() {
      var body = Ember['default'].$("body");
      var counter = body.data(COUNTER) || 0;
      body.addClass("lf-modal-open");
      body.data(COUNTER, counter + 1);
    },

    willDestroy: function willDestroy() {
      var body = Ember['default'].$("body");
      var counter = body.data(COUNTER) || 0;
      body.data(COUNTER, counter - 1);
      if (counter < 2) {
        body.removeClass("lf-modal-open");
      }
    }
  });

});
define('historic-locations/components/liquid-child', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["liquid-child"],
    attributeBindings: ["style"],
    style: Ember['default'].computed("visible", function () {
      return new Ember['default'].Handlebars.SafeString(this.get("visible") ? "" : "visibility:hidden");
    }),
    tellContainerWeRendered: Ember['default'].on("didInsertElement", function () {
      this.sendAction("didRender", this);
    })
  });

});
define('historic-locations/components/liquid-container', ['exports', 'ember', 'liquid-fire/growable', 'historic-locations/components/liquid-measured'], function (exports, Ember, Growable, liquid_measured) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend(Growable['default'], {
    classNames: ["liquid-container"],
    classNameBindings: ["liquidAnimating"],

    lockSize: function lockSize(elt, want) {
      elt.outerWidth(want.width);
      elt.outerHeight(want.height);
    },

    unlockSize: function unlockSize() {
      var _this = this;

      var doUnlock = function () {
        if (!_this.isDestroyed) {
          _this.set("liquidAnimating", false);
        }
        var elt = _this.$();
        if (elt) {
          elt.css({ width: "", height: "" });
        }
      };
      if (this._scaling) {
        this._scaling.then(doUnlock);
      } else {
        doUnlock();
      }
    },

    startMonitoringSize: Ember['default'].on("didInsertElement", function () {
      this._wasInserted = true;
    }),

    actions: {

      willTransition: function willTransition(versions) {
        if (!this._wasInserted) {
          return;
        }

        // Remember our own size before anything changes
        var elt = this.$();
        this._cachedSize = liquid_measured.measure(elt);

        // And make any children absolutely positioned with fixed sizes.
        for (var i = 0; i < versions.length; i++) {
          goAbsolute(versions[i]);
        }

        // Apply '.liquid-animating' to liquid-container allowing
        // any customizable CSS control while an animating is occuring
        this.set("liquidAnimating", true);
      },

      afterChildInsertion: function afterChildInsertion(versions) {
        var elt = this.$();

        // Measure  children
        var sizes = [];
        for (var i = 0; i < versions.length; i++) {
          if (versions[i].view) {
            sizes[i] = liquid_measured.measure(versions[i].view.$());
          }
        }

        // Measure ourself again to see how big the new children make
        // us.
        var want = liquid_measured.measure(elt);
        var have = this._cachedSize || want;

        // Make ourself absolute
        this.lockSize(elt, have);

        // Make the children absolute and fixed size.
        for (i = 0; i < versions.length; i++) {
          goAbsolute(versions[i], sizes[i]);
        }

        // Kick off our growth animation
        this._scaling = this.animateGrowth(elt, have, want);
      },

      afterTransition: function afterTransition(versions) {
        for (var i = 0; i < versions.length; i++) {
          goStatic(versions[i]);
        }
        this.unlockSize();
      }
    }
  });

  function goAbsolute(version, size) {
    if (!version.view) {
      return;
    }
    var elt = version.view.$();
    var pos = elt.position();
    if (!size) {
      size = liquid_measured.measure(elt);
    }
    elt.outerWidth(size.width);
    elt.outerHeight(size.height);
    elt.css({
      position: "absolute",
      top: pos.top,
      left: pos.left
    });
  }

  function goStatic(version) {
    if (version.view) {
      version.view.$().css({ width: "", height: "", position: "" });
    }
  }

});
define('historic-locations/components/liquid-if', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    _yieldInverse: ember_internals.inverseYieldMethod,
    hasInverse: Ember['default'].computed("inverseTemplate", function () {
      return !!this.get("inverseTemplate");
    })
  });

});
define('historic-locations/components/liquid-measured', ['exports', 'liquid-fire/mutation-observer', 'ember'], function (exports, MutationObserver, Ember) {

  'use strict';

  exports.measure = measure;

  exports['default'] = Ember['default'].Component.extend({

    didInsertElement: function didInsertElement() {
      var self = this;

      // This prevents margin collapse
      this.$().css({
        overflow: "auto"
      });

      this.didMutate();

      this.observer = new MutationObserver['default'](function (mutations) {
        self.didMutate(mutations);
      });
      this.observer.observe(this.get("element"), {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true
      });
      this.$().bind("webkitTransitionEnd", function () {
        self.didMutate();
      });
      // Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
      window.addEventListener("unload", function () {
        self.willDestroyElement();
      });
    },

    willDestroyElement: function willDestroyElement() {
      if (this.observer) {
        this.observer.disconnect();
      }
    },

    transitionMap: Ember['default'].inject.service("liquid-fire-transitions"),

    didMutate: function didMutate() {
      // by incrementing the running transitions counter here we prevent
      // tests from falling through the gap between the time they
      // triggered mutation the time we may actually animate in
      // response.
      var tmap = this.get("transitionMap");
      tmap.incrementRunningTransitions();
      Ember['default'].run.next(this, function () {
        this._didMutate();
        tmap.decrementRunningTransitions();
      });
    },

    _didMutate: function _didMutate() {
      var elt = this.$();
      if (!elt || !elt[0]) {
        return;
      }
      this.set("measurements", measure(elt));
    }

  });
  function measure($elt) {
    var width, height;

    // if jQuery sees a zero dimension, it will temporarily modify the
    // element's css to try to make its size measurable. But that's bad
    // for us here, because we'll get an infinite recursion of mutation
    // events. So we trap the zero case without hitting jQuery.

    if ($elt[0].offsetWidth === 0) {
      width = 0;
    } else {
      width = $elt.outerWidth();
    }
    if ($elt[0].offsetHeight === 0) {
      height = 0;
    } else {
      height = $elt.outerHeight();
    }

    return {
      width: width,
      height: height
    };
  }

});
define('historic-locations/components/liquid-modal', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["liquid-modal"],
    currentContext: Ember['default'].computed.oneWay("owner.modalContexts.lastObject"),

    owner: Ember['default'].inject.service("liquid-fire-modals"),

    innerView: Ember['default'].computed("currentContext", function () {
      var self = this,
          current = this.get("currentContext"),
          name = current.get("name"),
          container = this.get("container"),
          component = container.lookup("component-lookup:main").lookupFactory(name);
      Ember['default'].assert("Tried to render a modal using component '" + name + "', but couldn't find it.", !!component);

      var args = Ember['default'].copy(current.get("params"));

      args.registerMyself = Ember['default'].on("init", function () {
        self.set("innerViewInstance", this);
      });

      // set source so we can bind other params to it
      args._source = Ember['default'].computed(function () {
        return current.get("source");
      });

      var otherParams = current.get("options.otherParams");
      var from, to;
      for (from in otherParams) {
        to = otherParams[from];
        args[to] = Ember['default'].computed.alias("_source." + from);
      }

      var actions = current.get("options.actions") || {};

      // Override sendAction in the modal component so we can intercept and
      // dynamically dispatch to the controller as expected
      args.sendAction = function (name) {
        var actionName = actions[name];
        if (!actionName) {
          this._super.apply(this, Array.prototype.slice.call(arguments));
          return;
        }

        var controller = current.get("source");
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(actionName);
        controller.send.apply(controller, args);
      };

      return component.extend(args);
    }),

    actions: {
      outsideClick: function outsideClick() {
        if (this.get("currentContext.options.dismissWithOutsideClick")) {
          this.send("dismiss");
        } else {
          proxyToInnerInstance(this, "outsideClick");
        }
      },
      escape: function escape() {
        if (this.get("currentContext.options.dismissWithEscape")) {
          this.send("dismiss");
        } else {
          proxyToInnerInstance(this, "escape");
        }
      },
      dismiss: function dismiss() {
        var source = this.get("currentContext.source"),
            proto = source.constructor.proto(),
            params = this.get("currentContext.options.withParams"),
            clearThem = {};

        for (var key in params) {
          if (proto[key] instanceof Ember['default'].ComputedProperty) {
            clearThem[key] = undefined;
          } else {
            clearThem[key] = proto[key];
          }
        }
        source.setProperties(clearThem);
      }
    }
  });

  function proxyToInnerInstance(self, message) {
    var vi = self.get("innerViewInstance");
    if (vi) {
      vi.send(message);
    }
  }

});
define('historic-locations/components/liquid-outlet', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

	'use strict';

	exports['default'] = Ember['default'].Component.extend(ember_internals.OutletBehavior);

});
define('historic-locations/components/liquid-spacer', ['exports', 'historic-locations/components/liquid-measured', 'liquid-fire/growable', 'ember'], function (exports, liquid_measured, Growable, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend(Growable['default'], {
    enabled: true,

    didInsertElement: function didInsertElement() {
      var child = this.$("> div");
      var measurements = this.myMeasurements(liquid_measured.measure(child));
      this.$().css({
        overflow: "hidden",
        outerWidth: measurements.width,
        outerHeight: measurements.height
      });
    },

    sizeChange: Ember['default'].observer("measurements", function () {
      if (!this.get("enabled")) {
        return;
      }
      var elt = this.$();
      if (!elt || !elt[0]) {
        return;
      }
      var want = this.myMeasurements(this.get("measurements"));
      var have = liquid_measured.measure(this.$());
      this.animateGrowth(elt, have, want);
    }),

    // given our child's outerWidth & outerHeight, figure out what our
    // outerWidth & outerHeight should be.
    myMeasurements: function myMeasurements(childMeasurements) {
      var elt = this.$();
      return {
        width: childMeasurements.width + sumCSS(elt, padding("width")) + sumCSS(elt, border("width")),
        height: childMeasurements.height + sumCSS(elt, padding("height")) + sumCSS(elt, border("height"))
      };
      //if (this.$().css('box-sizing') === 'border-box') {
    }

  });

  function sides(dimension) {
    return dimension === "width" ? ["Left", "Right"] : ["Top", "Bottom"];
  }

  function padding(dimension) {
    var s = sides(dimension);
    return ["padding" + s[0], "padding" + s[1]];
  }

  function border(dimension) {
    var s = sides(dimension);
    return ["border" + s[0] + "Width", "border" + s[1] + "Width"];
  }

  function sumCSS(elt, fields) {
    var accum = 0;
    for (var i = 0; i < fields.length; i++) {
      var num = parseFloat(elt.css(fields[i]), 10);
      if (!isNaN(num)) {
        accum += num;
      }
    }
    return accum;
  }

});
define('historic-locations/components/liquid-versions', ['exports', 'ember', 'liquid-fire/ember-internals'], function (exports, Ember, ember_internals) {

  'use strict';

  var get = Ember['default'].get;
  var set = Ember['default'].set;

  exports['default'] = Ember['default'].Component.extend({
    tagName: "",
    name: "liquid-versions",

    transitionMap: Ember['default'].inject.service("liquid-fire-transitions"),

    appendVersion: Ember['default'].on("init", Ember['default'].observer("value", function () {
      var versions = get(this, "versions");
      var firstTime = false;
      var newValue = get(this, "value");
      var oldValue;

      if (!versions) {
        firstTime = true;
        versions = Ember['default'].A();
      } else {
        oldValue = versions[0];
      }

      // TODO: may need to extend the comparison to do the same kind of
      // key-based diffing that htmlbars is doing.
      if (!firstTime && (!oldValue && !newValue || oldValue === newValue)) {
        return;
      }

      this.notifyContainer("willTransition", versions);
      var newVersion = {
        value: newValue,
        shouldRender: newValue || get(this, "renderWhenFalse")
      };
      versions.unshiftObject(newVersion);

      this.firstTime = firstTime;
      if (firstTime) {
        set(this, "versions", versions);
      }

      if (!newVersion.shouldRender && !firstTime) {
        this._transition();
      }
    })),

    _transition: function _transition() {
      var _this = this;

      var versions = get(this, "versions");
      var transition;
      var firstTime = this.firstTime;
      this.firstTime = false;

      this.notifyContainer("afterChildInsertion", versions);

      transition = get(this, "transitionMap").transitionFor({
        versions: versions,
        parentElement: Ember['default'].$(ember_internals.containingElement(this)),
        use: get(this, "use"),
        // Using strings instead of booleans here is an
        // optimization. The constraint system can match them more
        // efficiently, since it treats boolean constraints as generic
        // "match anything truthy/falsy" predicates, whereas string
        // checks are a direct object property lookup.
        firstTime: firstTime ? "yes" : "no",
        helperName: get(this, "name")
      });

      if (this._runningTransition) {
        this._runningTransition.interrupt();
      }
      this._runningTransition = transition;

      transition.run().then(function (wasInterrupted) {
        // if we were interrupted, we don't handle the cleanup because
        // another transition has already taken over.
        if (!wasInterrupted) {
          _this.finalizeVersions(versions);
          _this.notifyContainer("afterTransition", versions);
        }
      }, function (err) {
        _this.finalizeVersions(versions);
        _this.notifyContainer("afterTransition", versions);
        throw err;
      });
    },

    finalizeVersions: function finalizeVersions(versions) {
      versions.replace(1, versions.length - 1);
    },

    notifyContainer: function notifyContainer(method, versions) {
      var target = get(this, "notify");
      if (target) {
        target.send(method, versions);
      }
    },

    actions: {
      childDidRender: function childDidRender(child) {
        var version = get(child, "version");
        set(version, "view", child);
        this._transition();
      }
    }

  });

});
define('historic-locations/components/liquid-with', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    name: "liquid-with"
  });

});
define('historic-locations/components/lm-container', ['exports', 'ember', 'liquid-fire/tabbable'], function (exports, Ember) {

  'use strict';

  /*
     Parts of this file were adapted from ic-modal

     https://github.com/instructure/ic-modal
     Released under The MIT License (MIT)
     Copyright (c) 2014 Instructure, Inc.
  */

  var lastOpenedModal = null;
  Ember['default'].$(document).on("focusin", handleTabIntoBrowser);

  function handleTabIntoBrowser() {
    if (lastOpenedModal) {
      lastOpenedModal.focus();
    }
  }

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["lm-container"],
    attributeBindings: ["tabindex"],
    tabindex: 0,

    keyUp: function keyUp(event) {
      // Escape key
      if (event.keyCode === 27) {
        this.sendAction();
      }
    },

    keyDown: function keyDown(event) {
      // Tab key
      if (event.keyCode === 9) {
        this.constrainTabNavigation(event);
      }
    },

    didInsertElement: function didInsertElement() {
      this.focus();
      lastOpenedModal = this;
    },

    willDestroy: function willDestroy() {
      lastOpenedModal = null;
    },

    focus: function focus() {
      if (this.get("element").contains(document.activeElement)) {
        // just let it be if we already contain the activeElement
        return;
      }
      var target = this.$("[autofocus]");
      if (!target.length) {
        target = this.$(":tabbable");
      }

      if (!target.length) {
        target = this.$();
      }

      target[0].focus();
    },

    constrainTabNavigation: function constrainTabNavigation(event) {
      var tabbable = this.$(":tabbable");
      var finalTabbable = tabbable[event.shiftKey ? "first" : "last"]()[0];
      var leavingFinalTabbable = finalTabbable === document.activeElement ||
      // handle immediate shift+tab after opening with mouse
      this.get("element") === document.activeElement;
      if (!leavingFinalTabbable) {
        return;
      }
      event.preventDefault();
      tabbable[event.shiftKey ? "last" : "first"]()[0].focus();
    },

    click: function click(event) {
      if (event.target === this.get("element")) {
        this.sendAction("clickAway");
      }
    }
  });

});
define('historic-locations/components/main-console', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    classNames: ["main-console"],

    onMap: (function () {
      return this.get("currentPath").split(".").indexOf("map") > 0;
    }).property("currentPath"),

    onExhibits: (function () {
      return this.get("currentPath").split(".").indexOf("exhibits") > 0;
    }).property("currentPath"),

    actions: {
      showPage: function showPage(page) {
        this.sendAction("showPage", page);
      }
    }

  });

});
define('historic-locations/controllers/application', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({

    actions: {
      showPage: function showPage(page) {
        this.transitionTo(page);
      }
    }

  });

});
define('historic-locations/controllers/exhibits/show', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].ObjectController.extend({});

});
define('historic-locations/controllers/map', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({

    actions: {
      goToExhibit: function goToExhibit(exhibit_id) {
        this.transitionTo("exhibits.show", exhibit_id);
      }
    }

  });

});
define('historic-locations/helpers/lf-yield-inverse', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = {
    isHTMLBars: true,
    helperFunction: ember_internals.inverseYieldHelper
  };

});
define('historic-locations/helpers/liquid-bind', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.makeHelperShim("liquid-bind");

});
define('historic-locations/helpers/liquid-if', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim("liquid-if", function (params, hash, options) {
    hash.helperName = "liquid-if";
    hash.inverseTemplate = options.inverse;
  });

});
define('historic-locations/helpers/liquid-outlet', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim("liquid-outlet", function (params, hash) {
    hash._outletName = params[0] || "main";
  });

});
define('historic-locations/helpers/liquid-unless', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

  'use strict';

  exports['default'] = ember_internals.makeHelperShim("liquid-if", function (params, hash, options) {
    hash.helperName = "liquid-unless";
    hash.inverseTemplate = options.template;
    options.template = options.inverse;
  });

});
define('historic-locations/helpers/liquid-with', ['exports', 'liquid-fire/ember-internals'], function (exports, ember_internals) {

	'use strict';

	exports['default'] = ember_internals.makeHelperShim("liquid-with");

});
define('historic-locations/initializers/app-version', ['exports', 'historic-locations/config/environment', 'ember'], function (exports, config, Ember) {

  'use strict';

  var classify = Ember['default'].String.classify;

  exports['default'] = {
    name: "App Version",
    initialize: function initialize(container, application) {
      var appName = classify(application.toString());
      Ember['default'].libraries.register(appName, config['default'].APP.version);
    }
  };

});
define('historic-locations/initializers/export-application-global', ['exports', 'ember', 'historic-locations/config/environment'], function (exports, Ember, config) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    var classifiedName = Ember['default'].String.classify(config['default'].modulePrefix);

    if (config['default'].exportApplicationGlobal && !window[classifiedName]) {
      window[classifiedName] = application;
    }
  }

  ;

  exports['default'] = {
    name: "export-application-global",

    initialize: initialize
  };

});
define('historic-locations/initializers/liquid-fire', ['exports', 'liquid-fire/router-dsl-ext'], function (exports) {

  'use strict';

  // This initializer exists only to make sure that the following import
  // happens before the app boots.
  exports['default'] = {
    name: "liquid-fire",
    initialize: function initialize() {}
  };

});
define('historic-locations/models/exhibit', ['exports', 'ember-data'], function (exports, DS) {

  'use strict';

  var Exhibit = DS['default'].Model.extend({
    title: DS['default'].attr("string"),
    address: DS['default'].attr("string"),
    url: DS['default'].attr("string"),
    latitude: DS['default'].attr("number"),
    longitude: DS['default'].attr("number"),
    description: DS['default'].attr("string")
  });

  Exhibit.reopenClass({
    FIXTURES: [{
      id: 1,
      title: "Everyone Loves Bikes",
      url: "https://s3.amazonaws.com/dougs/all-bikes.png",
      description: "Well I don't know, I guess I have some friends I don't see much that love doing things like this :)",
      latitude: 33.76743,
      longitude: -84.360744
    }, {
      id: 2,
      title: "Look How Sweet!",
      url: "https://s3.amazonaws.com/dougs/me-bikes-valentines.png",
      description: "This is just a sweet little picture",
      latitude: 33.769294,
      longitude: -84.362606
    }, {
      id: 3,
      title: "I Won",
      url: "https://s3.amazonaws.com/dougs/me-leonard-cohen.png",
      description: "I won this sweet vinyl!  And I was cold so I was waring Jenn's scarf.  But it all makes me look really cool!",
      latitude: 33.776683,
      longitude: -84.365357
    }, {
      id: 4,
      title: "Me In Woods",
      url: "https://s3.amazonaws.com/dougs/me-woods-cropped.png",
      description: "Well, this is just me in the woods.  That is all.",
      latitude: 33.781133,
      longitude: -84.36782
    }]
  });

  exports['default'] = Exhibit;

});
define('historic-locations/router', ['exports', 'ember', 'historic-locations/config/environment'], function (exports, Ember, config) {

  'use strict';

  var Router = Ember['default'].Router.extend({
    location: config['default'].locationType
  });

  Router.map(function () {
    this.route("landing");
    this.route("other");
    this.resource("exhibits", function () {
      this.route("show", { path: "/:exhibit_id" });
    });
    this.route("map");
  });

  exports['default'] = Router;

});
define('historic-locations/routes/exhibits', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({

    setupController: function setupController(controller) {
      var model = this.store.find("exhibit");
      controller.set("exhibits", model);
    }
  });

});
define('historic-locations/routes/exhibits/show', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({

    model: function model(params) {
      return this.store.find("exhibit", params.exhibit_id);
    }
  });

});
define('historic-locations/routes/map', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({

    model: function model() {
      return this.store.find("exhibit");
    }
  });

});
define('historic-locations/services/liquid-fire-modals', ['exports', 'liquid-fire/modals'], function (exports, Modals) {

	'use strict';

	exports['default'] = Modals['default'];

});
define('historic-locations/services/liquid-fire-transitions', ['exports', 'liquid-fire/transition-map'], function (exports, TransitionMap) {

	'use strict';

	exports['default'] = TransitionMap['default'];

});
define('historic-locations/templates/application', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "main-console", [], {"currentPath": get(env, context, "currentPath"), "showPage": "showPage"});
        content(env, morph1, context, "liquid-outlet");
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/google-map', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-bind', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, content = hooks.content;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "version", blockArguments[0]);
            content(env, morph0, context, "version");
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "use": get(env, context, "use"), "name": "liquid-bind", "renderWhenFalse": true, "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "version", blockArguments[0]);
              content(env, morph0, context, "version");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "use": get(env, context, "use"), "name": "liquid-bind", "renderWhenFalse": true}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "yield", [get(env, context, "this")], {});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-if', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
              content(env, morph0, context, "yield");
              return fragment;
            }
          };
        }());
        var child1 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, content = hooks.content;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
              content(env, morph0, context, "lf-yield-inverse");
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "valueVersion", blockArguments[0]);
            block(env, morph0, context, "if", [get(env, context, "valueVersion")], {}, child0, child1);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "name": get(env, context, "helperName"), "use": get(env, context, "use"), "renderWhenFalse": get(env, context, "hasInverse"), "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          var child0 = (function() {
            return {
              isHTMLBars: true,
              revision: "Ember@1.11.0",
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, content = hooks.content;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
                content(env, morph0, context, "yield");
                return fragment;
              }
            };
          }());
          var child1 = (function() {
            return {
              isHTMLBars: true,
              revision: "Ember@1.11.0",
              blockParams: 0,
              cachedFragment: null,
              hasRendered: false,
              build: function build(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("        ");
                dom.appendChild(el0, el1);
                var el1 = dom.createComment("");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode("\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              render: function render(context, env, contextualElement) {
                var dom = env.dom;
                var hooks = env.hooks, content = hooks.content;
                dom.detectNamespace(contextualElement);
                var fragment;
                if (env.useFragmentCache && dom.canClone) {
                  if (this.cachedFragment === null) {
                    fragment = this.build(dom);
                    if (this.hasRendered) {
                      this.cachedFragment = fragment;
                    } else {
                      this.hasRendered = true;
                    }
                  }
                  if (this.cachedFragment) {
                    fragment = dom.cloneNode(this.cachedFragment, true);
                  }
                } else {
                  fragment = this.build(dom);
                }
                var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
                content(env, morph0, context, "lf-yield-inverse");
                return fragment;
              }
            };
          }());
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "valueVersion", blockArguments[0]);
              block(env, morph0, context, "if", [get(env, context, "valueVersion")], {}, child0, child1);
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "name": get(env, context, "helperName"), "use": get(env, context, "use"), "renderWhenFalse": get(env, context, "hasInverse")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-measured', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        content(env, morph0, context, "yield");
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-modal', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"role","dialog");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var element0 = dom.childAt(fragment, [1]);
            var morph0 = dom.createMorphAt(element0,1,1);
            element(env, element0, context, "bind-attr", [], {"class": ":lf-dialog cc.options.dialogClass"});
            element(env, element0, context, "bind-attr", [], {"aria-labelledby": "cc.options.ariaLabelledBy", "aria-label": "cc.options.ariaLabel"});
            inline(env, morph0, context, "view", [get(env, context, "innerView")], {"dismiss": "dismiss"});
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, block = hooks.block, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
          dom.insertBoundary(fragment, 0);
          set(env, context, "cc", blockArguments[0]);
          block(env, morph0, context, "lm-container", [], {"action": "escape", "clickAway": "outsideClick"}, child0, null);
          content(env, morph1, context, "lf-overlay");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-versions", [], {"name": "liquid-modal", "value": get(env, context, "currentContext")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-outlet', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "outletStateVersion", blockArguments[0]);
          inline(env, morph0, context, "lf-outlet", [], {"staticState": get(env, context, "outletStateVersion")});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-with", [get(env, context, "outletState")], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass"), "use": get(env, context, "use"), "name": "liquid-outlet", "containerless": get(env, context, "containerless")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-spacer', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          content(env, morph0, context, "yield");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "liquid-measured", [], {"measurements": get(env, context, "measurements")}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-versions', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 0,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement) {
              var dom = env.dom;
              var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              inline(env, morph0, context, "yield", [get(env, context, "version.value")], {});
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 0,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement) {
            var dom = env.dom;
            var hooks = env.hooks, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            block(env, morph0, context, "liquid-child", [], {"version": get(env, context, "version"), "visible": false, "didRender": "childDidRender", "class": get(env, context, "innerClass")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 1,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement, blockArguments) {
          var dom = env.dom;
          var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          set(env, context, "version", blockArguments[0]);
          block(env, morph0, context, "if", [get(env, context, "version.shouldRender")], {}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "each", [get(env, context, "versions")], {}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/liquid-with', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "version", blockArguments[0]);
            inline(env, morph0, context, "yield", [get(env, context, "version")], {});
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "use": get(env, context, "use"), "name": get(env, context, "name"), "innerClass": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            isHTMLBars: true,
            revision: "Ember@1.11.0",
            blockParams: 1,
            cachedFragment: null,
            hasRendered: false,
            build: function build(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            render: function render(context, env, contextualElement, blockArguments) {
              var dom = env.dom;
              var hooks = env.hooks, set = hooks.set, get = hooks.get, inline = hooks.inline;
              dom.detectNamespace(contextualElement);
              var fragment;
              if (env.useFragmentCache && dom.canClone) {
                if (this.cachedFragment === null) {
                  fragment = this.build(dom);
                  if (this.hasRendered) {
                    this.cachedFragment = fragment;
                  } else {
                    this.hasRendered = true;
                  }
                }
                if (this.cachedFragment) {
                  fragment = dom.cloneNode(this.cachedFragment, true);
                }
              } else {
                fragment = this.build(dom);
              }
              var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, null);
              dom.insertBoundary(fragment, 0);
              set(env, context, "version", blockArguments[0]);
              inline(env, morph0, context, "yield", [get(env, context, "version")], {});
              return fragment;
            }
          };
        }());
        return {
          isHTMLBars: true,
          revision: "Ember@1.11.0",
          blockParams: 1,
          cachedFragment: null,
          hasRendered: false,
          build: function build(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          render: function render(context, env, contextualElement, blockArguments) {
            var dom = env.dom;
            var hooks = env.hooks, set = hooks.set, get = hooks.get, block = hooks.block;
            dom.detectNamespace(contextualElement);
            var fragment;
            if (env.useFragmentCache && dom.canClone) {
              if (this.cachedFragment === null) {
                fragment = this.build(dom);
                if (this.hasRendered) {
                  this.cachedFragment = fragment;
                } else {
                  this.hasRendered = true;
                }
              }
              if (this.cachedFragment) {
                fragment = dom.cloneNode(this.cachedFragment, true);
              }
            } else {
              fragment = this.build(dom);
            }
            var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, null);
            dom.insertBoundary(fragment, 0);
            set(env, context, "container", blockArguments[0]);
            block(env, morph0, context, "liquid-versions", [], {"value": get(env, context, "value"), "notify": get(env, context, "container"), "use": get(env, context, "use"), "name": get(env, context, "name")}, child0, null);
            return fragment;
          }
        };
      }());
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, block = hooks.block;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, null);
          dom.insertBoundary(fragment, 0);
          block(env, morph0, context, "liquid-container", [], {"id": get(env, context, "innerId"), "class": get(env, context, "innerClass")}, child0, null);
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "containerless")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/components/main-console', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-xs-6 col-sm-6");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h3");
        var el4 = dom.createTextNode("Map");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-xs-6 col-sm-6");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h3");
        var el4 = dom.createTextNode("Exhibits");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1, 1]);
        var element2 = dom.childAt(element0, [3, 1]);
        element(env, element1, context, "action", ["showPage", "map"], {});
        element(env, element2, context, "action", ["showPage", "exhibits"], {});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/exhibits', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.11.0",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          inline(env, morph0, context, "link-to", [get(env, context, "exhibit.title"), "exhibits.show", get(env, context, "exhibit.id")], {});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("ul");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
        block(env, morph0, context, "each", [get(env, context, "exhibits")], {"keyword": "exhibit"}, child0, null);
        content(env, morph1, context, "liquid-outlet");
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/exhibits/show', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-xs-12 col-sm-12 exhibit-image");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("img");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 1, 1]);
        element(env, element0, context, "bind-attr", [], {"src": get(env, context, "model.url")});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/landing', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("h1");
        var el2 = dom.createTextNode("LANDING");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,2,2,contextualElement);
        inline(env, morph0, context, "link-to", ["Other", "other"], {});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/map', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "google-map", [], {"locations": get(env, context, "model"), "onMarkerClick": "goToExhibit"});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/templates/other', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.11.0",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("h1");
        var el2 = dom.createTextNode("OTHER");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,2,2,contextualElement);
        inline(env, morph0, context, "link-to", ["Landing", "landing"], {});
        return fragment;
      }
    };
  }()));

});
define('historic-locations/tests/adapters/application.jshint', function () {

  'use strict';

  module('JSHint - adapters');
  test('adapters/application.js should pass jshint', function() { 
    ok(true, 'adapters/application.js should pass jshint.'); 
  });

});
define('historic-locations/tests/app.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('app.js should pass jshint', function() { 
    ok(true, 'app.js should pass jshint.'); 
  });

});
define('historic-locations/tests/components/google-map.jshint', function () {

  'use strict';

  module('JSHint - components');
  test('components/google-map.js should pass jshint', function() { 
    ok(false, 'components/google-map.js should pass jshint.\ncomponents/google-map.js: line 43, col 7, Function declarations should not be placed in blocks. Use a function expression or move the statement to the top of the outer function.\ncomponents/google-map.js: line 44, col 97, Missing semicolon.\ncomponents/google-map.js: line 52, col 7, Function declarations should not be placed in blocks. Use a function expression or move the statement to the top of the outer function.\ncomponents/google-map.js: line 9, col 19, \'google\' is not defined.\ncomponents/google-map.js: line 13, col 19, \'google\' is not defined.\ncomponents/google-map.js: line 23, col 26, \'google\' is not defined.\ncomponents/google-map.js: line 24, col 24, \'google\' is not defined.\ncomponents/google-map.js: line 30, col 7, \'google\' is not defined.\ncomponents/google-map.js: line 44, col 26, \'google\' is not defined.\ncomponents/google-map.js: line 45, col 26, \'google\' is not defined.\ncomponents/google-map.js: line 62, col 11, \'wpid\' is defined but never used.\n\n11 errors'); 
  });

});
define('historic-locations/tests/components/main-console.jshint', function () {

  'use strict';

  module('JSHint - components');
  test('components/main-console.js should pass jshint', function() { 
    ok(true, 'components/main-console.js should pass jshint.'); 
  });

});
define('historic-locations/tests/controllers/application.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/application.js should pass jshint', function() { 
    ok(true, 'controllers/application.js should pass jshint.'); 
  });

});
define('historic-locations/tests/controllers/exhibits/show.jshint', function () {

  'use strict';

  module('JSHint - controllers/exhibits');
  test('controllers/exhibits/show.js should pass jshint', function() { 
    ok(true, 'controllers/exhibits/show.js should pass jshint.'); 
  });

});
define('historic-locations/tests/controllers/map.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/map.js should pass jshint', function() { 
    ok(true, 'controllers/map.js should pass jshint.'); 
  });

});
define('historic-locations/tests/helpers/resolver', ['exports', 'ember/resolver', 'historic-locations/config/environment'], function (exports, Resolver, config) {

  'use strict';

  var resolver = Resolver['default'].create();

  resolver.namespace = {
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix
  };

  exports['default'] = resolver;

});
define('historic-locations/tests/helpers/resolver.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/resolver.js should pass jshint', function() { 
    ok(true, 'helpers/resolver.js should pass jshint.'); 
  });

});
define('historic-locations/tests/helpers/start-app', ['exports', 'ember', 'historic-locations/app', 'historic-locations/router', 'historic-locations/config/environment'], function (exports, Ember, Application, Router, config) {

  'use strict';



  exports['default'] = startApp;
  function startApp(attrs) {
    var application;

    var attributes = Ember['default'].merge({}, config['default'].APP);
    attributes = Ember['default'].merge(attributes, attrs); // use defaults, but you can override;

    Ember['default'].run(function () {
      application = Application['default'].create(attributes);
      application.setupForTesting();
      application.injectTestHelpers();
    });

    return application;
  }

});
define('historic-locations/tests/helpers/start-app.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/start-app.js should pass jshint', function() { 
    ok(true, 'helpers/start-app.js should pass jshint.'); 
  });

});
define('historic-locations/tests/models/exhibit.jshint', function () {

  'use strict';

  module('JSHint - models');
  test('models/exhibit.js should pass jshint', function() { 
    ok(true, 'models/exhibit.js should pass jshint.'); 
  });

});
define('historic-locations/tests/router.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('router.js should pass jshint', function() { 
    ok(false, 'router.js should pass jshint.\nrouter.js: line 12, col 48, Missing semicolon.\n\n1 error'); 
  });

});
define('historic-locations/tests/routes/exhibits.jshint', function () {

  'use strict';

  module('JSHint - routes');
  test('routes/exhibits.js should pass jshint', function() { 
    ok(true, 'routes/exhibits.js should pass jshint.'); 
  });

});
define('historic-locations/tests/routes/exhibits/show.jshint', function () {

  'use strict';

  module('JSHint - routes/exhibits');
  test('routes/exhibits/show.js should pass jshint', function() { 
    ok(true, 'routes/exhibits/show.js should pass jshint.'); 
  });

});
define('historic-locations/tests/routes/map.jshint', function () {

  'use strict';

  module('JSHint - routes');
  test('routes/map.js should pass jshint', function() { 
    ok(true, 'routes/map.js should pass jshint.'); 
  });

});
define('historic-locations/tests/test-helper', ['historic-locations/tests/helpers/resolver', 'ember-qunit'], function (resolver, ember_qunit) {

	'use strict';

	ember_qunit.setResolver(resolver['default']);

});
define('historic-locations/tests/test-helper.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('test-helper.js should pass jshint', function() { 
    ok(true, 'test-helper.js should pass jshint.'); 
  });

});
define('historic-locations/tests/transitions.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('transitions.js should pass jshint', function() { 
    ok(false, 'transitions.js should pass jshint.\ntransitions.js: line 8, col 2, Unnecessary semicolon.\n\n1 error'); 
  });

});
define('historic-locations/tests/unit/components/google-map-test', ['ember-qunit'], function (ember_qunit) {

  'use strict';

  ember_qunit.moduleForComponent("google-map", {});

  ember_qunit.test("it renders", function (assert) {
    assert.expect(2);

    // creates the component instance
    var component = this.subject();
    assert.equal(component._state, "preRender");

    // renders the component to the page
    this.render();
    assert.equal(component._state, "inDOM");
  });

  // specify the other units that are required for this test
  // needs: ['component:foo', 'helper:bar']

});
define('historic-locations/tests/unit/components/google-map-test.jshint', function () {

  'use strict';

  module('JSHint - unit/components');
  test('unit/components/google-map-test.js should pass jshint', function() { 
    ok(true, 'unit/components/google-map-test.js should pass jshint.'); 
  });

});
define('historic-locations/tests/unit/components/main-console-test', ['ember-qunit'], function (ember_qunit) {

  'use strict';

  ember_qunit.moduleForComponent("main-console", {});

  ember_qunit.test("it renders", function (assert) {
    assert.expect(2);

    // creates the component instance
    var component = this.subject();
    assert.equal(component._state, "preRender");

    // renders the component to the page
    this.render();
    assert.equal(component._state, "inDOM");
  });

  // specify the other units that are required for this test
  // needs: ['component:foo', 'helper:bar']

});
define('historic-locations/tests/unit/components/main-console-test.jshint', function () {

  'use strict';

  module('JSHint - unit/components');
  test('unit/components/main-console-test.js should pass jshint', function() { 
    ok(true, 'unit/components/main-console-test.js should pass jshint.'); 
  });

});
define('historic-locations/transitions', ['exports'], function (exports) {

  'use strict';

  exports['default'] = function () {
    this.transition(this.fromRoute("map"), this.toRoute("exhibits"), this.use("toUp"), this.reverse("toDown"));
  };

});
define('historic-locations/transitions/cross-fade', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = crossFade;
  // BEGIN-SNIPPET cross-fade-definition
  function crossFade() {
    var opts = arguments[0] === undefined ? {} : arguments[0];

    liquid_fire.stop(this.oldElement);
    return liquid_fire.Promise.all([liquid_fire.animate(this.oldElement, { opacity: 0 }, opts), liquid_fire.animate(this.newElement, { opacity: [opts.maxOpacity || 1, 0] }, opts)]);
  } // END-SNIPPET

});
define('historic-locations/transitions/default', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  // This is what we run when no animation is asked for. It just sets
  // the newly-added element to visible (because we always start them
  // out invisible so that transitions can control their initial
  // appearance).
  exports['default'] = defaultTransition;
  function defaultTransition() {
    if (this.newElement) {
      this.newElement.css({ visibility: "" });
    }
    return liquid_fire.Promise.resolve();
  }

});
define('historic-locations/transitions/explode', ['exports', 'ember', 'liquid-fire'], function (exports, Ember, liquid_fire) {

  'use strict';



  // Explode is not, by itself, an animation. It exists to pull apart
  // other elements so that each of the pieces can be targeted by
  // animations.

  exports['default'] = explode;

  function explode() {
    var _this = this;

    for (var _len = arguments.length, pieces = Array(_len), _key = 0; _key < _len; _key++) {
      pieces[_key] = arguments[_key];
    }

    var sawBackgroundPiece = false;
    var promises = pieces.map(function (piece) {
      if (piece.matchBy) {
        return matchAndExplode(_this, piece);
      } else if (piece.pick || piece.pickOld || piece.pickNew) {
        return explodePiece(_this, piece);
      } else {
        sawBackgroundPiece = true;
        return runAnimation(_this, piece);
      }
    });
    if (!sawBackgroundPiece) {
      if (this.newElement) {
        this.newElement.css({ visibility: "" });
      }
      if (this.oldElement) {
        this.oldElement.css({ visibility: "hidden" });
      }
    }
    return liquid_fire.Promise.all(promises);
  }

  function explodePiece(context, piece) {
    var childContext = Ember['default'].copy(context);
    var selectors = [piece.pickOld || piece.pick, piece.pickNew || piece.pick];
    var cleanupOld, cleanupNew;

    if (selectors[0] || selectors[1]) {
      cleanupOld = _explodePart(context, "oldElement", childContext, selectors[0]);
      cleanupNew = _explodePart(context, "newElement", childContext, selectors[1]);
      if (!cleanupOld && !cleanupNew) {
        return liquid_fire.Promise.resolve();
      }
    }

    return runAnimation(childContext, piece)["finally"](function () {
      if (cleanupOld) {
        cleanupOld();
      }
      if (cleanupNew) {
        cleanupNew();
      }
    });
  }

  function _explodePart(context, field, childContext, selector) {
    var child, childOffset, width, height, newChild;
    var elt = context[field];
    childContext[field] = null;
    if (elt && selector) {
      child = elt.find(selector);
      if (child.length > 0) {
        childOffset = child.offset();
        width = child.outerWidth();
        height = child.outerHeight();
        newChild = child.clone();

        // Hide the original element
        child.css({ visibility: "hidden" });

        // If the original element's parent was hidden, hide our clone
        // too.
        if (elt.css("visibility") === "hidden") {
          newChild.css({ visibility: "hidden" });
        }
        newChild.appendTo(elt.parent());
        newChild.outerWidth(width);
        newChild.outerHeight(height);
        var newParentOffset = newChild.offsetParent().offset();
        newChild.css({
          position: "absolute",
          top: childOffset.top - newParentOffset.top,
          left: childOffset.left - newParentOffset.left,
          margin: 0
        });

        // Pass the clone to the next animation
        childContext[field] = newChild;
        return function cleanup() {
          newChild.remove();
          child.css({ visibility: "" });
        };
      }
    }
  }

  function animationFor(context, piece) {
    var name, args, func;
    if (!piece.use) {
      throw new Error("every argument to the 'explode' animation must include a followup animation to 'use'");
    }
    if (Ember['default'].isArray(piece.use)) {
      name = piece.use[0];
      args = piece.use.slice(1);
    } else {
      name = piece.use;
      args = [];
    }
    if (typeof name === "function") {
      func = name;
    } else {
      func = context.lookup(name);
    }
    return function () {
      return liquid_fire.Promise.resolve(func.apply(this, args));
    };
  }

  function runAnimation(context, piece) {
    return new liquid_fire.Promise(function (resolve, reject) {
      animationFor(context, piece).apply(context).then(resolve, reject);
    });
  }

  function matchAndExplode(context, piece) {
    if (!context.oldElement) {
      return liquid_fire.Promise.resolve();
    }

    var hits = Ember['default'].A(context.oldElement.find("[" + piece.matchBy + "]").toArray());
    return liquid_fire.Promise.all(hits.map(function (elt) {
      return explodePiece(context, {
        pick: "[" + piece.matchBy + "=" + Ember['default'].$(elt).attr(piece.matchBy) + "]",
        use: piece.use
      });
    }));
  }

});
define('historic-locations/transitions/fade', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = fade;

  // BEGIN-SNIPPET fade-definition
  function fade() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    var firstStep;
    var outOpts = opts;
    var fadingElement = findFadingElement(this);

    if (fadingElement) {
      // We still have some older version that is in the process of
      // fading out, so out first step is waiting for it to finish.
      firstStep = liquid_fire.finish(fadingElement, "fade-out");
    } else {
      if (liquid_fire.isAnimating(this.oldElement, "fade-in")) {
        // if the previous view is partially faded in, scale its
        // fade-out duration appropriately.
        outOpts = { duration: liquid_fire.timeSpent(this.oldElement, "fade-in") };
      }
      liquid_fire.stop(this.oldElement);
      firstStep = liquid_fire.animate(this.oldElement, { opacity: 0 }, outOpts, "fade-out");
    }
    return firstStep.then(function () {
      return liquid_fire.animate(_this.newElement, { opacity: [opts.maxOpacity || 1, 0] }, opts, "fade-in");
    });
  }

  function findFadingElement(context) {
    for (var i = 0; i < context.older.length; i++) {
      var entry = context.older[i];
      if (liquid_fire.isAnimating(entry.element, "fade-out")) {
        return entry.element;
      }
    }
    if (liquid_fire.isAnimating(context.oldElement, "fade-out")) {
      return context.oldElement;
    }
  }
  // END-SNIPPET

});
define('historic-locations/transitions/flex-grow', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';


  exports['default'] = flexGrow;
  function flexGrow(opts) {
    liquid_fire.stop(this.oldElement);
    return liquid_fire.Promise.all([liquid_fire.animate(this.oldElement, { "flex-grow": 0 }, opts), liquid_fire.animate(this.newElement, { "flex-grow": [1, 0] }, opts)]);
  }

});
define('historic-locations/transitions/fly-to', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = flyTo;
  function flyTo() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    if (!this.newElement) {
      return liquid_fire.Promise.resolve();
    } else if (!this.oldElement) {
      this.newElement.css({ visibility: "" });
      return liquid_fire.Promise.resolve();
    }

    var oldOffset = this.oldElement.offset();
    var newOffset = this.newElement.offset();

    var motion = {
      translateX: newOffset.left - oldOffset.left,
      translateY: newOffset.top - oldOffset.top,
      outerWidth: this.newElement.outerWidth(),
      outerHeight: this.newElement.outerHeight()
    };

    this.newElement.css({ visibility: "hidden" });
    return liquid_fire.animate(this.oldElement, motion, opts).then(function () {
      _this.newElement.css({ visibility: "" });
    });
  }

});
define('historic-locations/transitions/move-over', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = moveOver;

  function moveOver(dimension, direction, opts) {
    var _this = this;

    var oldParams = {},
        newParams = {},
        firstStep,
        property,
        measure;

    if (dimension.toLowerCase() === "x") {
      property = "translateX";
      measure = "width";
    } else {
      property = "translateY";
      measure = "height";
    }

    if (liquid_fire.isAnimating(this.oldElement, "moving-in")) {
      firstStep = liquid_fire.finish(this.oldElement, "moving-in");
    } else {
      liquid_fire.stop(this.oldElement);
      firstStep = liquid_fire.Promise.resolve();
    }

    return firstStep.then(function () {
      var bigger = biggestSize(_this, measure);
      oldParams[property] = bigger * direction + "px";
      newParams[property] = ["0px", -1 * bigger * direction + "px"];

      return liquid_fire.Promise.all([liquid_fire.animate(_this.oldElement, oldParams, opts), liquid_fire.animate(_this.newElement, newParams, opts, "moving-in")]);
    });
  }

  function biggestSize(context, dimension) {
    var sizes = [];
    if (context.newElement) {
      sizes.push(parseInt(context.newElement.css(dimension), 10));
      sizes.push(parseInt(context.newElement.parent().css(dimension), 10));
    }
    if (context.oldElement) {
      sizes.push(parseInt(context.oldElement.css(dimension), 10));
      sizes.push(parseInt(context.oldElement.parent().css(dimension), 10));
    }
    return Math.max.apply(null, sizes);
  }

});
define('historic-locations/transitions/scale', ['exports', 'liquid-fire'], function (exports, liquid_fire) {

  'use strict';



  exports['default'] = scale;
  function scale() {
    var _this = this;

    var opts = arguments[0] === undefined ? {} : arguments[0];

    return liquid_fire.animate(this.oldElement, { scale: [0.2, 1] }, opts).then(function () {
      return liquid_fire.animate(_this.newElement, { scale: [1, 0.2] }, opts);
    });
  }

});
define('historic-locations/transitions/scroll-then', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = function (nextTransitionName, options) {
    var _this = this;

    for (var _len = arguments.length, rest = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      rest[_key - 2] = arguments[_key];
    }

    Ember['default'].assert("You must provide a transition name as the first argument to scrollThen. Example: this.use('scrollThen', 'toLeft')", "string" === typeof nextTransitionName);

    var el = document.getElementsByTagName("html");
    var nextTransition = this.lookup(nextTransitionName);
    if (!options) {
      options = {};
    }

    Ember['default'].assert("The second argument to scrollThen is passed to Velocity's scroll function and must be an object", "object" === typeof options);

    // set scroll options via: this.use('scrollThen', 'ToLeft', {easing: 'spring'})
    options = Ember['default'].merge({ duration: 500, offset: 0 }, options);

    // additional args can be passed through after the scroll options object
    // like so: this.use('scrollThen', 'moveOver', {duration: 100}, 'x', -1);

    return window.$.Velocity(el, "scroll", options).then(function () {
      nextTransition.apply(_this, rest);
    });
  };

});
define('historic-locations/transitions/to-down', ['exports', 'historic-locations/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "y", 1, opts);
  };

});
define('historic-locations/transitions/to-left', ['exports', 'historic-locations/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "x", -1, opts);
  };

});
define('historic-locations/transitions/to-right', ['exports', 'historic-locations/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "x", 1, opts);
  };

});
define('historic-locations/transitions/to-up', ['exports', 'historic-locations/transitions/move-over'], function (exports, moveOver) {

  'use strict';

  exports['default'] = function (opts) {
    return moveOver['default'].call(this, "y", -1, opts);
  };

});
/* jshint ignore:start */

/* jshint ignore:end */

/* jshint ignore:start */

define('historic-locations/config/environment', ['ember'], function(Ember) {
  var prefix = 'historic-locations';
/* jshint ignore:start */

try {
  var metaName = prefix + '/config/environment';
  var rawConfig = Ember['default'].$('meta[name="' + metaName + '"]').attr('content');
  var config = JSON.parse(unescape(rawConfig));

  return { 'default': config };
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

/* jshint ignore:end */

});

if (runningTests) {
  require("historic-locations/tests/test-helper");
} else {
  require("historic-locations/app")["default"].create({"name":"historic-locations","version":"0.0.0.b197d396"});
}

/* jshint ignore:end */
//# sourceMappingURL=historic-locations.map