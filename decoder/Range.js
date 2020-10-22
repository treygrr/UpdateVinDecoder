/**
 * Class for handling finite/infinite ranges easily
 */
export default class Range {
    /**
     * Constructor
     *
     * @param {number|null} start
     * @param {number|null} end
     */
    constructor(start, end) {
        this.start = Range.normalizeInput(start);
        this.end = Range.normalizeInput(end);
    }

    /**
     * Checks if this range equals another range.
     *
     * @param {Range} range
     * @return {Boolean}
     */
    equals(range) {
        return range instanceof Range && this.start === range.start && this.end === range.end;
    }

    /**
     * Checks if this range equals another range.
     *
     * @param {Range} range
     * @return {Boolean}
     */
    overlapsWith(range) {
        return range instanceof Range && (
            (null === range.start && null === range.end) ||
            (null === this.start && null === this.end) ||
            (null === this.start && range.start <= this.end) ||
            (null === this.end && range.end >= this.start) ||
            (null === range.start && this.start <= range.end) ||
            (null === range.end && this.end >= range.start) ||
            (range.start <= this.start && this.start <= range.end) ||
            (range.start <= this.end && this.end <= range.end) ||
            (this.start <= range.start && range.start <= this.end) ||
            (this.start <= range.end && range.end <= this.end)
        );
    }

    /**
     * Checks if the range is a superset of another range given passed to the method.
     *
     * @param {Range} range
     * @return {Boolean}
     */
    includes(range) {
        return range instanceof Range && (
            (null === this.start && null === this.end) ||
            (null === this.start && range.end <= this.end) ||
            (null === this.end && range.start >= this.start) ||
            (this.start <= range.start && range.end <= this.end)
        );
    }

    /**
     * Checks if the range is open-ended.
     *
     * @return {Boolean}
     */
    get isInfinite() {
        return null === this.start || null === this.end;
    }

    /**
     * Checks if the range is finite.
     *
     * @return {Boolean}
     */
    get isFinite() {
        return !this.isInfinite;
    }

    /**
     * Returns the string representation
     *
     * @return {String}
     */
    toString() {
        return [
            String(null === this.start ? '' : this.start),
            String(null === this.end ? '' : this.end),
        ].join('-');
    }

    /**
     * Generator
     */
    *[Symbol.iterator]() {
        yield* this.values();
    }

    /**
     * Returns the iterator.
     *
     * @return {Generator<number>}
     */
    *values() {
        if (this.isInfinite) {
            throw new RangeError('Range MUST be finite!');
        }

        for (let i = this.start; i <= this.end; i++) {
            yield i;
        }
    }

    /**
     * Collect overlaps between ranges
     *
     * @param  {...Range} ranges
     * @return {Generator<[Range, Range]>}
     */
    static *overlaps(...ranges) {
        // Search for overlapping ranges.
        for (let i = ranges.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                if (ranges[i].overlapsWith(ranges[j])) {
                    yield [ranges[i], ranges[j]];
                }
            }
        }
    }

    /**
     * Merges a series of rages into a single range.
     *
     * @param  {...Range} range
     * @return {Range}
     * @throws {RangeError}
     */
    static merge(...ranges) {
        return Range.sort(...ranges).reduce((merged, range) => {
            if (range.start != merged.end + 1) {
                throw new RangeError('Ranges are not sequential!');
            }

            return new Range(merged.start, range.end);
        });
    }

    /**
     * Sort ranges
     *
     * @param  {...Range} ranges
     * @return {Array<Range>}
     */
    static sort(...ranges) {
        return ranges.sort((r1, r2) => {
            if (r1.equals(r2)) {
                return 0;
            } else if (null === r1.start || (null !== r2.start && r1.start < r2.start)) {
                return -1;
            } else {
                return 1;
            }
        });
    }

    /**
     * Normalizes the input value passed to the constructor.
     *
     * @param {*} value
     * @return {number|null}
     */
    static normalizeInput(value) {
        value = Number.parseInt(value);

        return isNaN(value) ? null : value;
    }
}
