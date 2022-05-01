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
import LineString from 'ol/geom/LineString';
import * as source from 'ol/source';
import {
  getScaledDimension,
  getColorDimension,
} from 'app/features/dimensions';
import {
  defaultArrowStyleConfig,
  ArrowStyleConfig,
  ArrowStyleConfigFields,
  ArrowStyleConfigState,
  ArrowStyleConfigValues,
  ArrowStyleDimensions
} from '../../style/types';
import VectorLayer from 'ol/layer/Vector';
import { FieldFinder } from '../../utils/location';
import { fromLonLat } from 'ol/proj';
import { ArrowStyleEditor } from './arrowStyleEditor';
import Feature, { FeatureLike } from 'ol/Feature';
import { isNumber } from 'lodash';
import tinycolor from 'tinycolor2';
import { config } from '@grafana/runtime';

// Configuration options for Circle overlays
export interface ArrowsConfig {
  arrowstyle: ArrowStyleConfig;
};

const defaultOptions: ArrowsConfig = {
  arrowstyle: defaultArrowStyleConfig,
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

export async function getArrowStyleConfigState(cfg?: ArrowStyleConfig): Promise<ArrowStyleConfigState> {
  if (!cfg) {
    cfg = defaultArrowStyleConfig;
  }
  const fields: ArrowStyleConfigFields = {};
  const state: ArrowStyleConfigState = {
    config: cfg, // raw values
    fields,
    base: {
      color: config.theme2.visualization.getColorByName(cfg.color?.fixed ?? defaultArrowStyleConfig.color.fixed),
      opacity: cfg.opacity ?? defaultArrowStyleConfig.opacity,
      lineWidth: cfg.lineWidth?.fixed ?? defaultArrowStyleConfig.lineWidth.fixed,
    }
  };

  if (cfg.color?.field?.length) {
    fields.color = cfg.color.field;
  }
  if (cfg.lineWidth?.field?.length) {
    fields.lineWidth = cfg.lineWidth.field;
  }

  // Clear the fields if possible
  if (!Object.keys(fields).length) {
    state.fields = undefined;
  }
  return state;
}

const strokeMaker = (cfg: ArrowStyleConfigValues) => {
  const color = tinycolor(cfg.color).setAlpha(cfg.opacity ?? defaultArrowStyleConfig.opacity).toRgbString();
  return new Style({
    stroke: new Stroke({
      width: cfg.lineWidth,
      color: color,
    })
  });
}

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
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getArrowStyleConfigState(config.arrowstyle);

    // eventually can also use resolution for dynamic style
    const vectorLayer = new VectorLayer();

    if(!style.fields) {
      // Set a global style
      vectorLayer.setStyle(strokeMaker(style.base));
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx = feature.get("rowIndex") as number;
        const dims = style.dims;
        if(!dims || !(isNumber(idx))) {
          return strokeMaker(style.base);
        }

        const values = {...style.base};

        if (dims.color) {
          values.color = dims.color.get(idx);
        }
        if (dims.lineWidth) {
          values.lineWidth = dims.lineWidth.get(idx);
        }
        return strokeMaker(values);
      }
      );
    }
    
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

          if (style.fields) {
            const dims: ArrowStyleDimensions = {};
            if (style.fields.color) {
              dims.color = getColorDimension(frame, style.config.color ?? defaultArrowStyleConfig.color, theme);
            }
            if (style.fields.lineWidth) {
              dims.lineWidth = getScaledDimension(frame, style.config.lineWidth?? defaultArrowStyleConfig.lineWidth);
            }
            style.dims = dims;
          }

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
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.arrowstyle',
            path: 'config.arrowstyle',
            name: 'Styles',
            editor: ArrowStyleEditor,
            defaultValue: defaultOptions.arrowstyle,
          });
        },
    };
  },

  // fill in the default values
  defaultOptions,
};
