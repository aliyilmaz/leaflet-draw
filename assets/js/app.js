(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);
    } else if (typeof exports === 'object') {
        factory(require('leaflet'));
    } else {
        factory(L);
    }
}(function (L) {
    var DrawMapPlugin = L.Class.extend({
        initialize: function (options) {
            
            this._drawnItems = new L.FeatureGroup();
            this._edgeLabels = {};
            this._angleLabels = {};

            this.options.local = (options.local != undefined) ? options.local : undefined;
            if (this.options.local != undefined) {
                L.drawLocal = this.options.local;
            }

            this.options.edit = (options.edit != undefined) ? options.edit : {};
            this.options.edit.featureGroup = this._drawnItems;

            this.options.draw = (options.draw != undefined) ? options.draw : {};
            this.options.export = (options.export != undefined) ? options.export : {};
            this.options.import = (options.import != undefined) ? options.import : {};
            this.options.position = (options.position != undefined) ? options.position : 'topleft';

        },

        addTo: function (map) {
            this._map = map;
            this._map.addLayer(this._drawnItems);
            this._addControls();
            this._addDrawingTools();
            this._addExportButton();
            this._addImportButton();   
            this._dragFunctions();
        },

        _getAllTextBoxLabels: function() {
            let data = []; 
           
            const LabelElements = document.querySelectorAll('.custom-textbox-icon');
            for (let index = 0; index < LabelElements.length; index++) {
                const element = LabelElements[index];
                data.push(JSON.parse(element.dataset.geojson));
                
            }
            return data;
            
        },           
             
        _dragFunctions: function(files = null) {
            let that = this;
            const mapElement = document.getElementById('map');
            mapElement.addEventListener('dragover', (e) => {
                e.preventDefault();
                mapElement.style.backgroundColor = '#e6e6e6';
            });

            mapElement.addEventListener('dragleave', (e) => {
                e.preventDefault();
                mapElement.style.backgroundColor = '';
            });

            mapElement.addEventListener('drop', (e) => {
                e.preventDefault();
                mapElement.style.backgroundColor = '';
                handleFiles(e.dataTransfer.files);
            });

            if(files != null){
                handleFiles(files);
            }

            function handleFiles(files) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const content = e.target.result;
                        const extension = file.name.split('.').pop().toLowerCase();
            
                        switch (extension) {
                            case 'geojson':
                                handleGeoJSON(content);
                                break;
                            // default:
                            //     console.log('Unsupported file type. Please upload a valid file.');
                        }
                    };
                    reader.readAsText(file);
                }
            }        
            
            // Handle GeoJSON
            function handleGeoJSON(content) {                
                that._addGeoJSONShapes(JSON.parse(content));
            }            

        },
        
        _addControls: function () {
            L.control.zoom({
                position: "bottomright"
            }).addTo(this._map);
        },

        _addDrawingTools: function () {
            var drawControl = new L.Control.Draw({
                position:this.options.position,
                edit: this.options.edit,
                draw: this.options.draw
            });
            this._map.addControl(drawControl);

            this._map.on(L.Draw.Event.CREATED, this._onDrawCreated.bind(this));
            this._map.on(L.Draw.Event.EDITED, this._onDrawEdited.bind(this));
            this._map.on(L.Draw.Event.DELETED, this._onDrawDeleted.bind(this));
        },

        _onDrawCreated: function (event) {
            var layer = event.layer;
            this._drawnItems.addLayer(layer);

            this._addShapeLabels(layer);
            console.log(JSON.stringify(this._drawnItems.toGeoJSON()));
        },

        _onDrawEdited: function () {
            this._drawnItems.eachLayer(function (layer) {
                const layerOptions = layer.feature.properties;
                this._removeShapeLabels(layer);
                this._addShapeLabels(layer);
                layer.feature.properties = layerOptions;
            }.bind(this));
            console.log(JSON.stringify(this._drawnItems.toGeoJSON()));
        },

        _onDrawDeleted: function (event) {
            var layers = event.layers;
            layers.eachLayer(function (layer) {
                if (layer && layer.toGeoJSON) {
                    this._removeShapeLabels(layer);
                    this._drawnItems.removeLayer(layer);
                }
            }.bind(this));
            console.log(JSON.stringify(this._drawnItems.toGeoJSON()));
        },
        _addShapeLabels: function (layer) {
            if (layer instanceof L.Circle) {
                var radius = layer.getRadius();
                var center = layer.getLatLng();
                var circumference = 2 * Math.PI * radius; // Çevre hesaplama
                var angle = 360; // Daire olduğu için açı sabit

                var circumferenceLabel;
                if (circumference >= 1000) {
                    circumferenceLabel = (circumference / 1000).toFixed(2) + ' km';
                } else {
                    circumferenceLabel = this._round(circumference, 2) + ' m';
                }

                // Çevre etiketi ekle - Dairenin üst kısmına (yuvarlanmış)
                var edgeLabel = L.marker([center.lat + radius / 111320, center.lng], {
                    icon: L.divIcon({
                        className: `shape-edge-label shape-edge-label-${layer._leaflet_id}`,
                        html: circumferenceLabel,
                        iconSize: null // varsayılan width değeri kaldırıldı
                    })
                }).addTo(this._map);

                // Açı etiketi ekle - Dairenin sağ kısmına (açı sabit)
                var angleLabel = L.marker([center.lat, center.lng + radius / 111320], {
                    icon: L.divIcon({
                        className: `shape-angle-label shape-angle-label-${layer._leaflet_id}`,
                        html: angle + '°',
                        iconSize: null // varsayılan width değeri kaldırıldı
                    })
                }).addTo(this._map);

                this._edgeLabels[layer._leaflet_id] = [edgeLabel];
                this._angleLabels[layer._leaflet_id] = [angleLabel];

                // Circle için GeoJSON feature tanımı ve stil ekleme
                layer.feature = {
                    type: "Feature",
                    properties: {
                        type: "Circle",
                        radius: radius,
                        color: layer.options.color,
                        weight: layer.options.weight,
                        fillOpacity: layer.options.fillOpacity,
                        "stroke-opacity": layer.options.opacity,
                        fill: layer.options.fillColor || layer.options.color
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [center.lng, center.lat]
                    }
                };
                // console.log('Circle');
            } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
                var latlngs = layer.getLatLngs()[0];
                var result = this._calculateEdgesAndAngles(latlngs, layer._leaflet_id);
                
                // Polygon ve Rectangle için GeoJSON feature tanımı ve stil ekleme
                layer.feature = {
                    type: "Feature",
                    properties: {
                        type: this._is_rectangle(latlngs) ? "Rectangle" : "Polygon",
                        color: layer.options.color,
                        weight: layer.options.weight,
                        fillOpacity: layer.options.fillOpacity,
                        "stroke-opacity": layer.options.opacity,
                        fill: layer.options.fillColor || layer.options.color
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [latlngs.map(function (latlng) {
                            return [latlng.lng, latlng.lat];
                        })]
                    }
                };

                this._edgeLabels[layer._leaflet_id] = result.edgeLabels;
                this._angleLabels[layer._leaflet_id] = result.angleLabels;
            } else if (layer instanceof L.Polyline) {
                var latlngs = layer.getLatLngs();
                var result = this._calculateEdgesAndAngles(latlngs, layer._leaflet_id, 'Polyline');
                var PolylineStyle = layer.options || this.options.draw.polyline;
                // Polyline için GeoJSON feature tanımı ve stil ekleme
                layer.feature = {
                    type: "Feature",
                    properties: {
                        type: "Polyline",
                        color: PolylineStyle.color,
                        weight: PolylineStyle.weight,
                        opacity: PolylineStyle.opacity,
                        repeatMode: PolylineStyle.repeatMode
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: latlngs.map(function (latlng) {
                            return [latlng.lng, latlng.lat];
                        })
                    }
                };

                this._edgeLabels[layer._leaflet_id] = result.edgeLabels;
                this._angleLabels[layer._leaflet_id] = result.angleLabels;
            } else if (layer instanceof L.CircleMarker) {
                var circleMarkerStyle = layer.options || this.options.draw.circlemarker;

                // CircleMarker için GeoJSON feature tanımı ve stil ekleme
                layer.feature = {
                    type: "Feature",
                    properties: {
                        type: "CircleMarker",
                        color: circleMarkerStyle.color,
                        weight: circleMarkerStyle.weight,
                        fillOpacity: circleMarkerStyle.fillOpacity,
                        "stroke-opacity": circleMarkerStyle.opacity,
                        fill: circleMarkerStyle.fillColor || circleMarkerStyle.color,
                        repeatMode: circleMarkerStyle.repeatMode
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [layer.getLatLng().lng, layer.getLatLng().lat]
                    }
                };
                // console.log('CircleMarker');
            } else if (layer instanceof L.Marker) {
                var markerIcon = layer.options.icon ? layer.options.icon.options : this.options.draw.marker.icon;

                // Marker için GeoJSON feature tanımı ve stil ekleme
                layer.feature = {
                    type: "Feature",
                    properties: {
                        type: "Marker"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [layer.getLatLng().lng, layer.getLatLng().lat]
                    }
                };
                // console.log('Marker');
            }
        },

        _removeShapeLabels: function (layer) {
            var edgeLabels = this._edgeLabels[layer._leaflet_id];
            var angleLabels = this._angleLabels[layer._leaflet_id];
            var distanceLabel = this._dottedLabels ? this._dottedLabels[layer._leaflet_id] : null;
            var dottedLine = this._dottedLines ? this._dottedLines[layer._leaflet_id] : null;

            if (edgeLabels) {
                edgeLabels.forEach(function (label) {
                    this._map.removeLayer(label);
                }.bind(this));
                delete this._edgeLabels[layer._leaflet_id];
            }

            if (angleLabels) {
                angleLabels.forEach(function (label) {
                    this._map.removeLayer(label);
                }.bind(this));
                delete this._angleLabels[layer._leaflet_id];
            }

            if (distanceLabel) {
                this._map.removeLayer(distanceLabel);
                delete this._dottedLabels[layer._leaflet_id];
            }

            if (dottedLine) {
                this._map.removeLayer(dottedLine);
                delete this._dottedLines[layer._leaflet_id];
            }
        },

        _round: function (num, len) {
            return Math.round(num * (Math.pow(10, len))) / (Math.pow(10, len));
        },

        _calculateEdgesAndAngles: function (latlngs, layerId, type = null) {

            let edges = [];
            let angles = [];
            let edgeLabels = [];
            let angleLabels = [];
            let existingLabels = new Set();

            for (let i = 0; i < latlngs.length; i++) {
                let pointA = latlngs[i];
                let pointB = latlngs[(i + 1) % latlngs.length];
                let pointC = latlngs[(i + 2) % latlngs.length];

                // Edge length
                let distance = Math.round(pointA.distanceTo(pointB));
                let distanceLabel;

                if (distance >= 1000) {
                    distanceLabel = (distance / 1000).toFixed(2) + ' km';
                } else {
                    distanceLabel = Math.round(distance) + ' m';
                }
                edges.push(distance);

                // Add edge length label
                let midPoint = L.latLng(
                    (pointA.lat + pointB.lat) / 2,
                    (pointA.lng + pointB.lng) / 2
                );

                if (!existingLabels.has(midPoint.toString())) {
                    let edgeLabel = L.marker(midPoint, {
                        icon: L.divIcon({
                            className: `shape-edge-label shape-edge-label-${layerId}`,
                            html: distanceLabel
                        })
                    }).addTo(this._map);
                    edgeLabels.push(edgeLabel);
                    existingLabels.add(midPoint.toString());
                }

                // Angle calculation using Web Mercator projection
                let deltaX = pointB.lat - pointA.lat;
                let deltaY = pointB.lng - pointA.lng;
                let angleDeg = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                angleDeg = (angleDeg < 0) ? angleDeg + 360 : angleDeg;
                angles.push(angleDeg);

                // Add angle label
                let angleLabel = L.marker(pointB, {
                    icon: L.divIcon({
                        className: `shape-angle-label shape-angle-label-${layerId}`,
                        html: angleDeg.toFixed(2) + '°'
                    })
                }).addTo(this._map);
                angleLabels.push(angleLabel);

            }

            // Calculate the distance between the start and end points and add the label
            if (latlngs.length > 2 && type == 'Polyline') { // Only when there is more than one line
                var startPoint = latlngs[0];
                var endPoint = latlngs[latlngs.length - 1];
                // Add faint and dot dot line
                var dottedLine = L.polyline([startPoint, endPoint], {
                    className: `dotted-line dotted-line-${layerId}` // Faint and dot dot line class
                }).addTo(this._map);

                // Keep Dotted Line and Label
                if (!this._dottedLines) {
                    this._dottedLines = {};
                }
                this._dottedLines[layerId] = dottedLine;
            }

            return { edges: edges, angles: angles, edgeLabels: edgeLabels, angleLabels: angleLabels };
        },


        _addExportButton: function () {
            var defaultExportOptions = {
                button: {
                    status:true,
                    text: 'Export',
                    title: "Download Geojson File",
                    svgicon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M64 464c-8.8 0-16-7.2-16-16L48 64c0-8.8 7.2-16 16-16l160 0 0 80c0 17.7 14.3 32 32 32l80 0 0 288c0 8.8-7.2 16-16 16L64 464zM64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-293.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0L64 0zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>'
                }
            };

            this.options.export.button = {
                ...defaultExportOptions.button,
                ...this.options.export.button
            };

            if (!this.options.export.button.status) {
                return;
            }

            var showExport = `<a href="#" id="geojson-export" title="${this.options.export.button.title}" type="button"> ${this.options.export.button.svgicon} ${this.options.export.button.text}</a>`;
            var showExportButton = new L.Control({ position: "topright" });
            showExportButton.onAdd = function (map) {
                this._div = L.DomUtil.create('div');
                this._div.innerHTML = showExport;
                return this._div;
            };
            showExportButton.addTo(this._map);

            document.getElementById('geojson-export').onclick = function () {
                this._geojsonExport();
            }.bind(this);
        },

        _addImportButton: function () {
            var that = this;
            var defaultImportOptions = {
                button: {
                    status:true,
                    text: 'Import',
                    title: "Upload the geojson file",
                    svgicon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM216 408c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-102.1-31 31c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l72-72c9.4-9.4 24.6-9.4 33.9 0l72 72c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-31-31L216 408z"/></svg>'
                }                
            };

            this.options.import.button = {
                ...defaultImportOptions.button,
                ...this.options.import.button
            };

            if (!this.options.import.button.status) {
                return;
            }
            var showImport = `<a href="#" id="geojson-import" title="${this.options.import.button.title}" type="button"> ${this.options.import.button.svgicon} ${this.options.import.button.text} <input type="file" multiple id="geojson-file" accept=".geojson" style="display:none;" /></a>`;
            var showImportButton = new L.Control({ position: "topright" });
            showImportButton.onAdd = function (map) {
                this._div = L.DomUtil.create('div');
                this._div.innerHTML = showImport;
                return this._div;
            };
            showImportButton.addTo(this._map);


            document.getElementById('geojson-import').onclick = function () {
                document.getElementById('geojson-file').click();
            };

            document.getElementById('geojson-file').onchange = function (event) {
                var files = event.target.files;
                that._dragFunctions(files);
            };
            
        },
        _is_rectangle: function (latlngs) {
            // Noktalar (x1, y1), (x2, y2), (x3, y3), (x4, y4)
            if (latlngs.length !== 4) {
                return false; // Eğer dört nokta yoksa, geçersiz.
            }

            const [p1, p2, p3, p4] = latlngs;

            // Kenar uzunluklarını hesaplayan yardımcı fonksiyon
            function distance(p1, p2) {
                return Math.sqrt(Math.pow(p2.lng - p1.lng, 2) + Math.pow(p2.lat - p1.lat, 2));
            }

            // Kenar uzunlukları
            const d1 = distance(p1, p2); // p1-p2
            const d2 = distance(p2, p3); // p2-p3
            const d3 = distance(p3, p4); // p3-p4
            const d4 = distance(p4, p1); // p4-p1

            // Çapraz uzunlukları
            const diag1 = distance(p1, p3); // p1-p3
            const diag2 = distance(p2, p4); // p2-p4

            // Dikdörtgen kontrolü: Karşılıklı kenarlar eşit ve çaprazlar eşit olmalı
            const isRectangle = (d1 === d3 && d2 === d4 && diag1 === diag2);

            // Kare kontrolü: Tüm kenar uzunlukları eşit ve çaprazlar eşit olmalı
            const isSquare = (d1 === d2 && d1 === d3 && d1 === d4 && diag1 === diag2);

            // Kare veya Dikdörtgen kontrolü
            return isRectangle || isSquare; // Birinden biri true olursa, true döner.
        },

        _addGeoJSONShapes: function (geojson) {
            var that = this;
        
            geojson.features.forEach(function (feature) {
                var layer;
        
                if (feature.properties && feature.properties.type === 'Label') {                    
                    layer = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
                        icon: L.divIcon({
                            className: 'custom-textbox-icon',
                            html: feature.properties.text,
                        }),
                        draggable: true
                    });                                    
                    
                    layer.feature = {
                        type: "Feature",
                        properties: {
                            type: "Label",
                            id: feature.properties.id,
                            text:feature.properties.text
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]
                        }
                    };              
                    
                    layer.addTo(that._map);
                    const element = layer.getElement();
                    element.setAttribute('data-geojson', JSON.stringify(feature));
                    

                } else if (feature.properties && feature.properties.type === 'CircleMarker') {
                    var circleMarkerStyle = {
                        color: feature.properties.color || L.Draw.CircleMarker.prototype.options.color,
                        weight: feature.properties.weight || L.Draw.CircleMarker.prototype.options.weight,
                        fillOpacity: feature.properties.fillOpacity || L.Draw.CircleMarker.prototype.options.fillOpacity,
                        opacity: feature.properties["stroke-opacity"],
                        fillColor: feature.properties.fill || L.Draw.CircleMarker.prototype.options.fillColor,
                        repeatMode: feature.properties.repeatMode || L.Draw.CircleMarker.prototype.options.repeatMode
                    };
                    layer = L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], circleMarkerStyle);
                } else if (feature.properties && feature.properties.type === 'Marker') {
                    layer = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
                        icon: feature.properties.icon ? L.icon(feature.properties.icon) : new L.Icon.Default()
                    });
                } else if (feature.properties && feature.properties.type === 'Circle') {
                    var circleStyle = {
                        color: feature.properties.color || L.Draw.Circle.prototype.options.color,
                        weight: feature.properties.weight || L.Draw.Circle.prototype.options.weight,
                        fillOpacity: feature.properties.fillOpacity || L.Draw.Circle.prototype.options.fillOpacity,
                        opacity: feature.properties["stroke-opacity"],
                        fillColor: feature.properties.fill || L.Draw.Circle.prototype.options.fillColor
                    };
                    layer = L.circle([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], { radius: feature.properties.radius, ...circleStyle });
                } else if (feature.properties && (feature.properties.type === 'Polygon')) {
                    var latlngs = feature.geometry.coordinates[0].map(function (coord) {
                        return [coord[1], coord[0]];
                    });
        
                    var polygonStyle = {
                        color: feature.properties.color,
                        weight: feature.properties.weight,
                        fillOpacity: feature.properties.fillOpacity,
                        opacity: feature.properties["stroke-opacity"],
                        fillColor: feature.properties.fill
                    };
        
                    layer = L.polygon(latlngs, polygonStyle);
                }  else if (feature.properties && (feature.properties.type === 'Rectangle')) {
                    var latlngs = feature.geometry.coordinates[0].map(function (coord) {
                        return [coord[1], coord[0]];
                    });
        
                    var rectangleStyle = {
                        color: feature.properties.color,
                        weight: feature.properties.weight,
                        fillOpacity: feature.properties.fillOpacity,
                        opacity: feature.properties["stroke-opacity"],
                        fillColor: feature.properties.fill
                    };
        
                    layer = L.rectangle(latlngs, rectangleStyle);
                } else if (feature.properties && feature.properties.type === 'Polyline') {
                    var polylineLatLngs = feature.geometry.coordinates.map(function (coord) {
                        return [coord[1], coord[0]];
                    });
        
                    var polylineStyle = {
                        color: feature.properties.color || L.Draw.Polyline.prototype.options.shapeOptions.color,
                        weight: feature.properties.weight || L.Draw.Polyline.prototype.options.shapeOptions.weight,
                        opacity: feature.properties.opacity || L.Draw.Polyline.prototype.options.shapeOptions.opacity
                    };
        
                    layer = L.polyline(polylineLatLngs, polylineStyle);
                }
        
                if (layer) {
                    
                    if(feature.properties != undefined && feature.properties.type != 'Label'){
                        that._drawnItems.addLayer(layer);
                    }
        
                    if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
                        var isRectangle = that._is_rectangle(feature.geometry.coordinates[0]);
        
                        layer.feature = {
                            type: "Feature",
                            properties: {
                                type: isRectangle ? "Rectangle" : "Polygon",
                                ...feature.properties
                            },
                            geometry: feature.geometry
                        };
        
                        if (that._map.hasLayer(layer)) {
                            that._addShapeLabels(layer);
                        }
                    } else if (layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
                        layer.feature = feature;
        
                        if (that._map.hasLayer(layer)) {
                            that._addShapeLabels(layer);
                        }
                    } else if (layer instanceof L.Polyline) {
                        layer.setStyle({
                            color: feature.properties.color || L.Draw.Polyline.prototype.options.shapeOptions.color,
                            weight: feature.properties.weight || L.Draw.Polyline.prototype.options.shapeOptions.weight,
                            opacity: feature.properties.opacity || L.Draw.Polyline.prototype.options.shapeOptions.opacity
                        });
        
                        layer.feature = feature;
        
                        if (that._map.hasLayer(layer)) {
                            that._addShapeLabels(layer);
                        }
                    }
                }
            });
        },        

        _geojsonExport: function() {
            const labels = this._getAllTextBoxLabels();
            if (this._drawnItems) {                
                let drawnItemsJson = this._drawnItems.toGeoJSON();
                    
                if (drawnItemsJson.features) {
                    labels.forEach(function(label){
                        
                        if (label.properties && label.properties.type === 'Label') {
                            drawnItemsJson.features.push(label);                            
                        }
                    });
                } 
        
                let jsonData = JSON.stringify(drawnItemsJson);      
                let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonData);
                let datenow = new Date();
                let exportFileDefaultName = 'export_draw_' + datenow.toLocaleDateString('en-GB') + '.geojson';
                let linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
            } else {
                console.error("drawnItems is not defined.");
            }
        }
             
        
        

    });

    L.drawMapPlugin = function (options) {        
        return new DrawMapPlugin(options);
    };
}));
