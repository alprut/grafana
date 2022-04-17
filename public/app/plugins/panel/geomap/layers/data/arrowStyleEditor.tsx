import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import {
  ColorPicker,
  Field,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  SliderValueEditor,
} from '@grafana/ui';
import { Observable } from 'rxjs';

import {
  ColorDimensionEditor,
  ScaleDimensionEditor,
} from 'app/features/dimensions/editors';
import {
  ScaleDimensionConfig,
  ColorDimensionConfig,
} from 'app/features/dimensions/types';
import { defaultArrowStyleConfig, ArrowStyleConfig } from '../../style/types';
import { LayerContentInfo } from '../../utils/getFeatures';

export interface ArrowStyleEditorOptions {
  layerInfo?: Observable<LayerContentInfo>;
  simpleFixedValues?: boolean;
}

export const ArrowStyleEditor: FC<StandardEditorProps<ArrowStyleConfig, ArrowStyleEditorOptions, any>> = ({
  value,
  context,
  onChange,
  item,
}) => {
  const settings = item.settings;

  const onLineWidthChange = (lineWidthValue: ScaleDimensionConfig | undefined) => {
    onChange({ ...value, lineWidth: lineWidthValue });
  };

  const onColorChange = (colorValue: ColorDimensionConfig | undefined) => {
    onChange({ ...value, color: colorValue });
  };

  const onOpacityChange = (opacityValue: number | undefined) => {
    onChange({ ...value, opacity: opacityValue });
  };

  // Simple fixed value display
  if (settings?.simpleFixedValues) {
    return (
      <>
        <InlineFieldRow>
          <InlineField label="Color" labelWidth={10}>
            <InlineLabel width={4}>
              <ColorPicker
                color={value?.color?.fixed ?? defaultArrowStyleConfig.color.fixed}
                onChange={(v) => {
                  onColorChange({ fixed: v });
                }}
              />
            </InlineLabel>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Opacity" labelWidth={10} grow>
            <SliderValueEditor
              value={value?.opacity ?? defaultArrowStyleConfig.opacity}
              context={context}
              onChange={onOpacityChange}
              item={
                {
                  settings: {
                    min: 0,
                    max: 1,
                    step: 0.1,
                  },
                } as any
              }
            />
          </InlineField>
        </InlineFieldRow>
      </>
    );
  }

  return (
    <>
      <Field label={'Line Width'}>
        <ScaleDimensionEditor
          value={value?.lineWidth ?? defaultArrowStyleConfig.lineWidth}
          context={context}
          onChange={onLineWidthChange}
          item={
            {
              settings: {
                min: 1,
                max: 100,
              },
            } as any
          }
        />
      </Field>
      <Field label={'Color'}>
        <ColorDimensionEditor
          value={value?.color ?? defaultArrowStyleConfig.color}
          context={context}
          onChange={onColorChange}
          item={{} as any}
        />
      </Field>
      <Field label={'Fill opacity'}>
        <SliderValueEditor
          value={value?.opacity ?? defaultArrowStyleConfig.opacity}
          context={context}
          onChange={onOpacityChange}
          item={
            {
              settings: {
                min: 0,
                max: 1,
                step: 0.1,
              },
            } as any
          }
        />
      </Field>
    </>
  );
};
