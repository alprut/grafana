import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  DataFrame,
} from '@grafana/data';
import { Style, Stroke } from 'ol/style';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import * as source from 'ol/source';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
import VectorLayer from 'ol/layer/Vector';
import { FieldFinder } from '../../utils/location';
import { fromLonLat } from 'ol/proj';

// Configuration options for Circle overlays
export interface ArrowsConfig {
  style: StyleConfig;
}

const defaultOptions: ArrowsConfig = {
  style: defaultStyleConfig,
};

export const ARROWS_LAYER_ID = 'arrows';

// Used by default when nothing is configured
export const defaultArrowsConfig: MapLayerOptions<ArrowsConfig> = {
  type: ARROWS_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  tooltip: true,
};

export interface LineStringInfo {
    warning?: string;
    lineStrings: LineString[];
}

function matchLowerNames(names: Set<string>): FieldFinder {
  return (frame: DataFrame) => {
    for (const field of frame.fields) {
      if (names.has(field.name.toLowerCase())) {
        return field;
      }
    }
    return undefined;
  };
}

function dataFrameToLineString(frame: DataFrame): LineStringInfo {
    console.log(frame);
    const info: LineStringInfo = {
      lineStrings: [],
    };

    const fields = {
      src_lat: matchLowerNames(new Set(['src_lat']))(frame),
      src_lot: matchLowerNames(new Set(['src_lot']))(frame),
      dst_lat: matchLowerNames(new Set(['dst_lat']))(frame),
      dst_lot: matchLowerNames(new Set(['dst_lot']))(frame),
    };

    if (!fields.src_lat) {
      info.warning = "src_lat field not found.";
      return info;
    }
    if (!fields.src_lot) {
      info.warning = "src_lot field not found.";
      return info;
    }
    if (!fields.dst_lat) {
      info.warning = "dst_lat field not found.";
      return info;
    }
    if (!fields.dst_lot) {
      info.warning = "dst_lot field not found.";
      return info;
    }

    const count = frame.length;
    for (let i = 0; i < count; i++) {
      const arrow: LineString = new LineString( [
        fromLonLat([ fields.src_lot.values.get(i), fields.src_lat.values.get(i) ]),
        fromLonLat([ fields.dst_lot.values.get(i), fields.dst_lat.values.get(i) ])
      ]);

      info.lineStrings.push(arrow);
    }

    return info;
}

const getArrowFeatures = (frame: DataFrame, info: LineStringInfo): Array<Feature<LineString>> | undefined => {
  const features: Array<Feature<LineString>> = [];

  // Map each data value into new points
  for (let i = 0; i < frame.length; i++) {
    features.push(
      new Feature({
        frame,
        rowIndex: i,
        geometry: info.lineStrings[i],
      })
    );
  }

  return features;
};

/**
 * Map layer configuration for arrow overlay
 */
export const arrowsLayer: MapLayerRegistryItem<ArrowsConfig> = {
  id: ARROWS_LAYER_ID,
  name: 'Arrows',
  description: 'arrow to render parent/child relationships between data points',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<ArrowsConfig>, theme: GrafanaTheme2) => {
    // Assert default values
    /*
    const config = {
      ...defaultOptions,
      ...options?.config,
    };
    */

    // const style = await getStyleConfigState(config.style);

    // eventually can also use resolution for dynamic style
    const vectorLayer = new VectorLayer();

    const style: Style = new Style({
      stroke: new Stroke({
        width: 6, color: [237, 30, 164, 0.8]
      }),
    });

    vectorLayer.setStyle(style);

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return; // ignore empty
        }

        const features: Feature<LineString>[] = [];

        for (const frame of data.series) {
          const info = dataFrameToLineString(frame);
          if (info.warning)
            continue;

          const frameFeatures = getArrowFeatures(frame, info);
          if (frameFeatures) {
            features.push(...frameFeatures);
          }

          break; // Only the first frame for now!
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
