import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, RegistryItem, Registry } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

interface GsiMapThemeItem extends RegistryItem {
  style: string;
  ext: string;
  minZoom: number;
  maxZoom: number;
}

const GSI_DEFAULT_THEME = 'Standard';

export const mapThemeRegistry = new Registry<GsiMapThemeItem>(() => [
  {
    id: GSI_DEFAULT_THEME,
    name: 'Standard',
    style: 'std',
    ext: 'png',
    minZoom: 1,
    maxZoom: 18,
  },
  {
    id: 'Pale',
    name: 'Pale',
    style: 'pale',
    ext: 'png',
    minZoom: 2,
    maxZoom: 18,
  },
  {
    id: 'English',
    name: 'English',
    style: 'english',
    ext: 'png',
    minZoom: 5,
    maxZoom: 11,
  },
  {
    id: 'Photo',
    name: 'Photo',
    style: 'seamlessphoto',
    ext: 'jpg',
    minZoom: 2,
    maxZoom: 18,
  },
  {
    id: 'Blank',
    name: 'Blank',
    style: 'blank',
    ext: 'png',
    minZoom: 5,
    maxZoom: 14,
  },
]);

export interface GSIConfig {
  theme: string;
}

export const defaultGSIConfig: GSIConfig = {
  theme: GSI_DEFAULT_THEME,
};

export const gsi: MapLayerRegistryItem<GSIConfig> = {
  id: 'gsi',
  name: 'GSI Japan map',
  isBaseMap: true,
  defaultOptions: defaultGSIConfig,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<GSIConfig>, theme: GrafanaTheme2) => ({
    init: () => {
      const cfg = { ...defaultGSIConfig, ...options.config };
      const theme = mapThemeRegistry.getIfExists(cfg.theme ?? GSI_DEFAULT_THEME)!;
      return new TileLayer({
        source: new XYZ({
          attributions: `<a href="https://maps.gsi.go.jp/development/ichiran.html">©The Geospatial Information Authority of Japan</a>`,
          url: `https://cyberjapandata.gsi.go.jp/xyz/${theme.style}/{z}/{x}/{y}.${theme.ext}`,
        }),
        minZoom: theme.minZoom,
        maxZoom: theme.maxZoom,
      });
    },
    registerOptionsUI: (builder) => {
      builder.addSelect({
        path: 'config.theme',
        name: 'Theme',
        settings: {
          options: mapThemeRegistry.selectOptions().options,
        },
      });
    },
  }),
};

export const gsiLayers = [gsi];
