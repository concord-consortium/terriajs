import { VectorTileFeature } from "@mapbox/vector-tile";
import i18next from "i18next";
import { clone } from "lodash-es";
import { action, computed, observable, runInAction } from "mobx";
import { json_style } from "protomaps/src/compat/json_style";
import { LabelRule } from "protomaps/src/labeler";
import { Rule as PaintRule } from "protomaps/src/painter";
import { LineSymbolizer, PolygonSymbolizer } from "protomaps/src/symbolizer";
import ImageryLayerFeatureInfo from "terriajs-cesium/Source/Scene/ImageryLayerFeatureInfo";
import isDefined from "../../../Core/isDefined";
import ProtomapsImageryProvider from "../../../Map/ProtomapsImageryProvider";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin, { MapItem } from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import LegendTraits, {
  LegendItemTraits
} from "../../../Traits/TraitsClasses/LegendTraits";
import MapboxVectorTileCatalogItemTraits from "../../../Traits/TraitsClasses/MapboxVectorTileCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import createStratumInstance from "../../Definition/createStratumInstance";
import LoadableStratum from "../../Definition/LoadableStratum";
import { BaseModel } from "../../Definition/Model";
import StratumOrder from "../../Definition/StratumOrder";

class MapboxVectorTileLoadableStratum extends LoadableStratum(
  MapboxVectorTileCatalogItemTraits
) {
  static stratumName = "MapboxVectorTileLoadable";

  constructor(readonly item: MapboxVectorTileCatalogItem) {
    super();
  }

  duplicateLoadableStratum(newModel: BaseModel): this {
    return new MapboxVectorTileLoadableStratum(
      newModel as MapboxVectorTileCatalogItem
    ) as this;
  }

  static async load(item: MapboxVectorTileCatalogItem) {
    return new MapboxVectorTileLoadableStratum(item);
  }

  get opacity() {
    return 1;
  }

  @computed get legends() {
    if (!this.item.fillColor && !this.item.lineColor) return [];
    return [
      createStratumInstance(LegendTraits, {
        items: [
          createStratumInstance(LegendItemTraits, {
            color: this.item.fillColor,
            outlineColor: this.item.lineColor,
            title: this.item.name
          })
        ]
      })
    ];
  }
}

StratumOrder.addLoadStratum(MapboxVectorTileLoadableStratum.stratumName);

class MapboxVectorTileCatalogItem extends MappableMixin(
  UrlMixin(CatalogMemberMixin(CreateModel(MapboxVectorTileCatalogItemTraits)))
) {
  @observable
  public readonly forceProxy = true;

  static readonly type = "mvt";

  get type() {
    return MapboxVectorTileCatalogItem.type;
  }

  get typeName() {
    return i18next.t("models.mapboxVectorTile.name");
  }

  async forceLoadMetadata() {
    const stratum = await MapboxVectorTileLoadableStratum.load(this);
    runInAction(() => {
      this.strata.set(MapboxVectorTileLoadableStratum.stratumName, stratum);
    });
  }

  @computed
  get parsedJsonStyle() {
    if (this.style) {
      return json_style(this.style, new Map());
    }
  }

  @computed
  /** Convert traits into paint rules:
   * - `layer` and `fillColor`/`lineColor` into simple rules
   * - `parsedJsonStyle`
   */
  get paintRules(): PaintRule[] {
    let rules: PaintRule[] = [];

    if (this.layer) {
      if (this.fillColor) {
        rules.push({
          dataLayer: this.layer,
          symbolizer: new PolygonSymbolizer({ fill: this.fillColor }),
          minzoom: this.minimumZoom,
          maxzoom: this.maximumZoom
        });
      }
      if (this.lineColor) {
        rules.push({
          dataLayer: this.layer,
          symbolizer: new LineSymbolizer({ color: this.lineColor }),
          minzoom: this.minimumZoom,
          maxzoom: this.maximumZoom
        });
      }
    }

    if (this.parsedJsonStyle) {
      rules.push(
        ...((<unknown>this.parsedJsonStyle.paint_rules) as PaintRule[])
      );
    }

    return rules;
  }

  @computed
  get labelRules(): LabelRule[] {
    if (this.parsedJsonStyle) {
      return (<unknown>this.parsedJsonStyle.label_rules) as LabelRule[];
    }
    return [];
  }

  @computed
  get imageryProvider(): ProtomapsImageryProvider | undefined {
    if (this.url === undefined) {
      return;
    }

    return new ProtomapsImageryProvider({
      url: this.url,
      minimumZoom: this.minimumZoom,
      maximumNativeZoom: this.maximumNativeZoom,
      maximumZoom: this.maximumZoom,
      credit: this.attribution,
      paintRules: this.paintRules,
      labelRules: this.labelRules
      // featureInfoFunc: this.featureInfoFromFeature,
    });

    // this.fillColor, strokeStyle: this.lineColor

    // https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1Ijoibmlja2ZvcmJlc3NtaXRoIiwiYSI6ImNraXd0MTEycjF6YXgzNHA0b21od2RkbWQifQ.LH6pdVXW-BKmoiQ5wV7i4w
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed
  get mapItems(): MapItem[] {
    if (this.isLoadingMapItems || this.imageryProvider === undefined) {
      return [];
    }

    return [
      {
        imageryProvider: this.imageryProvider,
        show: this.show,
        alpha: this.opacity,
        clippingRectangle: this.clipToRectangle
          ? this.cesiumRectangle
          : undefined
      }
    ];
  }

  @action.bound
  featureInfoFromFeature(feature: VectorTileFeature) {
    const featureInfo = new ImageryLayerFeatureInfo();
    if (isDefined(this.nameProperty)) {
      featureInfo.name = feature.properties[this.nameProperty];
    }
    (featureInfo as any).properties = clone(feature.properties);
    featureInfo.data = {
      id: feature.properties[this.idProperty]
    }; // For highlight
    return featureInfo;
  }
}

export default MapboxVectorTileCatalogItem;
