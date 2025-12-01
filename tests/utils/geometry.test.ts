import { describe, it, expect } from 'vitest';
import { parsePosList, transformCoordinates } from '../../src/utils/geometry';

describe('Geometry Utils', () => {
  describe('parsePosList', () => {
    it('should parse a valid space-separated string of coordinates', () => {
      const input = '100 200 110 210 120 220';
      const expected = [
        [100, 200],
        [110, 210],
        [120, 220],
      ];
      expect(parsePosList(input)).toEqual(expected);
    });

    it('should handle floating point numbers', () => {
      const input = '100.5 200.123 110.0 210.99';
      const expected = [
        [100.5, 200.123],
        [110.0, 210.99],
      ];
      expect(parsePosList(input)).toEqual(expected);
    });

    it('should ignore extra trailing whitespace', () => {
      const input = '  100 200   ';
      const expected = [[100, 200]];
      expect(parsePosList(input)).toEqual(expected);
    });

    it('should return empty array for empty string', () => {
      expect(parsePosList('')).toEqual([]);
    });

    it('should return empty array for non-string input', () => {
      expect(parsePosList(null as any)).toEqual([]);
      expect(parsePosList(undefined as any)).toEqual([]);
      expect(parsePosList(123 as any)).toEqual([]);
    });

    it('should handle an odd number of coordinates gracefully (drop last)', () => {
      const input = '100 200 300';
      // Should probably parse [100, 200] and ignore 300 because it has no pair
      // The implementation loop: i=0 (push 0,1), i=2 (2+1 < 3 is false) -> stop.
      const expected = [[100, 200]];
      expect(parsePosList(input)).toEqual(expected);
    });
  });

  describe('transformCoordinates', () => {
    it('should transform coordinates from RD New to WGS84', () => {
      // Amersfoort / Onze Lieve Vrouwetoren (Center of RD New)
      // RD: 155000, 463000 -> WGS84: ~52.15517, 5.38720
      const rdCoords = [[155000, 463000]];
      const result = transformCoordinates(rdCoords);

      expect(result).toHaveLength(1);
      const [lon, lat] = result[0];

      // Check approximate values (precision varies by lib)
      expect(lon).toBeCloseTo(5.387, 2); // Longitude
      expect(lat).toBeCloseTo(52.155, 2); // Latitude
    });

    it('should handle empty array', () => {
      expect(transformCoordinates([])).toEqual([]);
    });

    it('should transform multiple points', () => {
      const rdCoords = [
        [155000, 463000],
        [156000, 464000],
      ];
      const result = transformCoordinates(rdCoords);
      expect(result).toHaveLength(2);
      expect(result[0][0]).not.toBe(155000); // Should be transformed
    });
  });
});
