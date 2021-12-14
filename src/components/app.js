import React, { Component} from "react";

import {Icon, Style, Text, Fill, Stroke} from 'ol/style';
import LineString from 'ol/geom/LineString';
import 'ol/ol.css';
import Map from 'ol/Map';
import Projection from 'ol/proj/Projection';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import Point from 'ol/geom/Point';
import { buffer, containsCoordinate} from 'ol/extent';
import View from 'ol/View';
import {Image as ImageLayer, Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {linear} from 'ol/easing'
import XYZ from 'ol/source/XYZ';

import "./app.css";

import { isInRange, toMapCoords, toGameCoords, loadPath, savePath } from '../utils';

class App extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isRecording: true,
            precision: 0.5,
            trackedPlayer: 'Enlokah',
            waypoints: 0,
            pathColor: [10, 130, 10, 0.8],
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
    }

    updateMapDraw = () => {
        //clear current features
        this.vectorSource.clear(true);
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
        this.vectorSource.addFeature(pathFeature);
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