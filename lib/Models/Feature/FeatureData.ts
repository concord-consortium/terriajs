import TimeIntervalCollectionProperty from "terriajs-cesium/Source/DataSources/TimeIntervalCollectionProperty";

/** Terria specific properties */
export interface TerriaFeatureData {
  type: "terriaFeatureData";

  /** If feature is time-based, this can be used instead of `Feature.properties` */
  timeIntervalCollection?: TimeIntervalCollectionProperty;

  /** For features generated by TableMixin (see createLongitudeLatitudeFeaturePerId/Row and createRegionMappedImageryProvider */
  rowIds?: number[];
}

export function isTerriaFeatureData(data: any): data is TerriaFeatureData {
  return data && "type" in data && data.type === "terriaFeatureData";
}