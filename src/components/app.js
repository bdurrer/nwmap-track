import React, { Component} from "react";

import {Style, Fill, Stroke, Circle as CircleStyle} from 'ol/style';
import LineString from 'ol/geom/LineString';
import 'ol/ol.css';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import {containsCoordinate} from 'ol/extent';
import View from 'ol/View';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import XYZ from 'ol/source/XYZ';

import Markers from '../data/coords.json';

import "./app.css";

import { isInRange, toMapCoords, toGameCoords, loadPath, savePath } from '../utils';

const styles = {
    crystal: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#ded8d8'}),
            stroke: new Stroke({color: '#3f3f3f', width: 1}),
        }),
    }),
    gold: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#c2a965'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    silver: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#b7b7b7'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    iron: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#8a8a8a'}),
            stroke: new Stroke({color: '#383838', width: 1}),
        }),
    }),
    lodestone: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#bd51c5'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    orichalcum: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#ff5422'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    starmetal: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#429de8'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    default: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#211f1f'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),
    saltpeter: new Style({
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#211f1f'}),
            stroke: new Stroke({color: '#ffffff', width: 1}),
        }),
    }),

}

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isRecording: true,
            precision: 0.5,
            trackedPlayer: 'Enlokah',
            waypoints: 0,
            pathColor: [10, 130, 10, 0.8],
            maxMarkers: 4000,
        }
    }

    componentDidMount() {
        this.path = loadPath();
        this.mapPath = this.path.map(val => toMapCoords(val));
        this.setState({
            waypoints: this.path.length,
        });
        console.log('path initialized with', this.path.length, 'waypoints');

        this.initMap();
        this.updateMapDraw();
        this.updateMarkers();
        this.initSocket();
        this.startAutoSave();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevState.isRecording !== this.state.isRecording) {
            if (this.state.isRecording) {
                this.startAutoSave();
            } else {
                this.stopAutoSave();
            }
        }
    }

    initMap() {
        this.vectorPathSource = new VectorSource({
            features: [],
        });

        this.vectorPathLayer = new VectorLayer({
            source: this.vectorPathSource,
            renderMode: "vector",
            updateWhileAnimating: true,
            updateWhileInteracting: true,
        });

        this.vectorSource = new VectorSource({
            features: [],
        });

        this.vectorLayer = new VectorLayer({
            source: this.vectorSource,
            renderMode: "vector",
            updateWhileAnimating: true,
            updateWhileInteracting: true,
        });

        const layers = [
            new TileLayer({
                source: new XYZ({
                    url: 'https://cdn.newworldminimap.com/file/nwminimap/{z}/{x}/{y}.png',
                    minZoom: 2,
                    maxZoom: 8
                }),
            }),
            this.vectorLayer,
            this.vectorPathLayer,
        ];

        let startPosition = [9356.67, 2693.11];
        if (this.path && this.path.length) {
            startPosition = this.path[this.path.length - 1];
        }



        this.view = new View({
            center: toMapCoords(startPosition),
            zoom: 7,
        })

        this.map = new Map({
            target: 'map-container',
            layers: layers,
            view: this.view,
        });

        this.map.on('moveend', this.maybeUpdateMarkers);
    }

    initSocket() {
        const ws = new WebSocket('wss://localhost.newworldminimap.com:42224/Location');
        ws.onmessage = this.onWsEvent;
    }

    startAutoSave() {
        if (!this.saveInterval) {
            console.log('startAutoSave');
            this.saveInterval = setInterval(() => {
                console.log('saving', this.path.length, 'waypoints');
                savePath(this.path);
            }, 30000);
        }
    }

    stopAutoSave() {
        console.log('stopAutoSave');
        clearInterval(this.saveInterval);
        this.saveInterval = null;
    }

    onClickClear = () => {
        window.localStorage.setItem('playerPath', '[]');
        this.path = [];
        this.mapPath = [];
        this.setState({
            waypoints: 0,
        }, this.updateMapDraw);
    }

    onClickToggleRecording = () => {
        this.setState((state) => ({
            isRecording: !state.isRecording,
        }));
    }

    onWsEvent = (event) => {
        if (!this.state.isRecording) {
            return;
        }

        const data = JSON.parse(event.data);
        if (!data || data.type !== 'LOCAL_POSITION_UPDATE') {
            console.log('not a position update', event.data);
            return;
        }

        if (data.playerName !== this.state.trackedPlayer) {
            // not the tracked player
            return;
        }

        const [x, y] = data.position;
        if (this.path.length) {
            const [lastX, lastY] = this.path[this.path.length - 1];

            if (isInRange(x, lastX, this.state.precision) && isInRange(y, lastY, this.state.precision)) {
                // didn't move enough
                return;
            }
        }

        this.path.push([x, y]);
        this.mapPath.push(toMapCoords(data.position));
        this.setState({
            waypoints: this.path.length,
        });
        this.updateMapDraw();
        this.updateMarkers();
    }

    updateMapDraw = () => {
        //clear current features
        this.vectorPathSource.clear(true);
        const features_to_add = [];
        // add all features in one go

        const pathFeature = new Feature({
            type: 'route',
            geometry: new LineString(this.mapPath),
        });
        pathFeature.setStyle(new Style({
            stroke: new Stroke({
                width: 6,
                color: this.state.pathColor,
            })
        }));

        features_to_add.push(pathFeature);
        this.vectorPathSource.addFeatures(features_to_add);
    }

    updateMarkers = () => {
        this.vectorSource.clear(true);

        const features = this.buildMarkerFeatures();
        this.vectorSource.addFeatures(features);
    }

    maybeUpdateMarkers = () => {
        console.log('maybeUpdateMarkers');
        this.updateMarkers();
    }

    buildMarkerFeatures() {
        const current_view = this.map.getView();
        const bounds = current_view.calculateExtent(this.map.getSize());

        let num_markers = 0;
        const features_to_add = [];
        for(const subCategoryName in Markers.ores) {
            const items = Markers.ores[subCategoryName];
            let item;
            for (const itemName in items) {
                item = items[itemName];
                let mapPos = toMapCoords([item.x, item.y]);
                if (!containsCoordinate(bounds, mapPos)) {
                    continue;
                }
                const newMarker = new Feature({
                    geometry: new Point(mapPos),
                    name: itemName,
                });

                newMarker.setStyle(styles[subCategoryName] || styles.default);
                features_to_add.push(newMarker);

                num_markers += 1;

                // Break clause, never load more than MAX_MARKERS markers
                if (num_markers >= this.state.maxMarkers) {
                    return features_to_add;
                }
            }
        }
        return features_to_add;
    }

    render(){
        return(
            <div className="app">
                <div className="map" id="map-container" />

                <div className="controls">
                    <button onClick={this.onClickClear}>Clear recorded path</button>
                    <button onClick={this.onClickToggleRecording}>{this.state.isRecording ? 'Stop recording' : 'Start recording'}</button>

                    <p>{this.state.waypoints} waypoints</p>
                </div>
            </div>
        );
    }
}

export default App;