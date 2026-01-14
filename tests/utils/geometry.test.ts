import { describe, it, expect } from "vitest"
import {
  parsePosList,
  transformCoordinates,
  convertGeoJSONToGML,
} from "../../src/utils/geometry"

describe("Geometry Utils", () => {
  describe("parsePosList", () => {
    it("should parse a valid space-separated string of coordinates", () => {
      const input = "100 200 110 210 120 220"
      const expected = [
        [100, 200],
        [110, 210],
        [120, 220],
      ]
      expect(parsePosList(input)).toEqual(expected)
    })

    it("should handle floating point numbers", () => {
      const input = "100.5 200.123 110.0 210.99"
      const expected = [
        [100.5, 200.123],
        [110.0, 210.99],
      ]
      expect(parsePosList(input)).toEqual(expected)
    })

    it("should ignore extra trailing whitespace", () => {
      const input = "  100 200   "
      const expected = [[100, 200]]
      expect(parsePosList(input)).toEqual(expected)
    })

    it("should return empty array for empty string", () => {
      expect(parsePosList("")).toEqual([])
    })

    it("should return empty array for non-string input", () => {
      expect(parsePosList(null as any)).toEqual([])
      expect(parsePosList(undefined as any)).toEqual([])
      expect(parsePosList(123 as any)).toEqual([])
    })

    it("should handle an odd number of coordinates gracefully (drop last)", () => {
      const input = "100 200 300"
      // Should probably parse [100, 200] and ignore 300 because it has no pair
      // The implementation loop: i=0 (push 0,1), i=2 (2+1 < 3 is false) -> stop.
      const expected = [[100, 200]]
      expect(parsePosList(input)).toEqual(expected)
    })
  })

  describe("transformCoordinates", () => {
    it("should transform coordinates from RD New to WGS84", () => {
      // Amersfoort / Onze Lieve Vrouwetoren (Center of RD New)
      // RD: 155000, 463000 -> WGS84: ~52.15517, 5.38720
      const rdCoords = [[155000, 463000]]
      const result = transformCoordinates(rdCoords)

      expect(result).toHaveLength(1)
      const [lon, lat] = result[0]

      // Check approximate values (precision varies by lib)
      expect(lon).toBeCloseTo(5.387, 2) // Longitude
      expect(lat).toBeCloseTo(52.155, 2) // Latitude
    })

    it("should handle empty array", () => {
      expect(transformCoordinates([])).toEqual([])
    })

    it("should transform multiple points", () => {
      const rdCoords = [
        [155000, 463000],
        [156000, 464000],
      ]
      const result = transformCoordinates(rdCoords)
      expect(result).toHaveLength(2)
      expect(result[0][0]).not.toBe(155000) // Should be transformed
    })
  })

  describe("convertGeoJSONToGML", () => {
    it("should convert a simple Polygon to GML", () => {
      const polygon: any = {
        type: "Polygon",
        coordinates: [
          [
            [5.0, 52.0],
            [5.1, 52.0],
            [5.1, 52.1],
            [5.0, 52.1],
            [5.0, 52.0],
          ],
        ],
      }

      const gml = convertGeoJSONToGML(polygon)

      expect(gml).toContain("<gml:Polygon>")
      expect(gml).toContain(
        '<gml:exterior><gml:LinearRing><gml:posList srsName="EPSG:28992">',
      )
      expect(gml).toContain("</gml:posList></gml:LinearRing></gml:exterior>")
      expect(gml).toContain("</gml:Polygon>")

      // Check if coordinates are transformed (checking format primarily)
      // RD coordinates should be large numbers (e.g. > 100000)
      // We expect output like "12345.6789 45678.9012 ..."
      // Since 5.0, 52.0 is roughly ...
      // Just check regex for space separated pairs
      expect(gml).toMatch(/\d+\.\d{4} \d+\.\d{4}/)
    })

    it("should convert a MultiPolygon to GML", () => {
      const multiPolygon: any = {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [5.0, 52.0],
              [5.1, 52.0],
              [5.1, 52.1],
              [5.0, 52.1],
              [5.0, 52.0],
            ],
          ],
        ],
      }

      const gml = convertGeoJSONToGML(multiPolygon)

      expect(gml).toContain("<gml:MultiSurface>")
      expect(gml).toContain("<gml:surfaceMember>")
      expect(gml).toContain("<gml:Polygon>")
      expect(gml).toContain('srsName="EPSG:28992"')
    })

    it("should convert a Polygon with interior rings (holes) to GML", () => {
      const polygon: any = {
        type: "Polygon",
        coordinates: [
          [
            [5.0, 52.0],
            [5.1, 52.0],
            [5.1, 52.1],
            [5.0, 52.1],
            [5.0, 52.0],
          ],
          [
            [5.02, 52.02],
            [5.08, 52.02],
            [5.08, 52.08],
            [5.02, 52.08],
            [5.02, 52.02],
          ],
        ],
      }

      const gml = convertGeoJSONToGML(polygon)

      expect(gml).toContain("<gml:Polygon>")
      expect(gml).toContain("<gml:exterior>")
      expect(gml).toContain("<gml:interior>")
      expect(gml.split("<gml:posList").length - 1).toBe(2) // 2 posLists
    })

    it("should handle Polygon with no rings gracefully", () => {
      const polygon: any = {
        type: "Polygon",
        coordinates: [],
      }
      const gml = convertGeoJSONToGML(polygon)
      expect(gml).toBe("<gml:Polygon></gml:Polygon>")
    })

    it("should return empty string for null/undefined", () => {
      expect(convertGeoJSONToGML(null)).toBe("")
      expect(convertGeoJSONToGML(undefined)).toBe("")
    })

    it("should throw error for unsupported type", () => {
      const point = { type: "Point", coordinates: [5.0, 52.0] }
      expect(() => convertGeoJSONToGML(point)).toThrow(
        /Unsupported geometry type/,
      )
    })
  })
})
