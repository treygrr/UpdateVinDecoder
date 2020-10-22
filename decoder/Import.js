import Range from './Range';
import jsonSchema from './schema/Import.json';
import JSONSchemaValidator from 'ajv';
import { getTypeOf, flattenArray } from './utils';
import {
    EmptyCodeError,
    IllegalCodeError,
    ParseError,
    IllegalConditionalError
} from './errors';
import ParameterizedValue from './ParameterizedValue';

const validateSchema = (new JSONSchemaValidator()).compile(jsonSchema);

/**
 * Converts a code to an SQL-compatible regular expression pattern.
 * Invalid codes are ignored for composite codes (comma-separated code)
 * Exception thrown for invalid codes that are not recognized at the moment.
 *
 * @param {String} code
 * @param {Number} length
 * @return {String}
 */
function parseCode(code, length = 1) {
    if ([undefined, null, '-', ''].includes(code) || 'string' !== getTypeOf(code)) {
        throw new EmptyCodeError(code);
    }

    code = code.toUpperCase();

    if (code.includes(',')) {          // "A, B, C"
        try {
            return code.trim().split(/\s*,\s*/g)
                .map(c => parseCode(c, length))
                .join('|')
            ;
        } catch (e) {
            throw new IllegalCodeError(code);
        }
    // } else if (/^(?=.*\*)(?:\*|)(?:[A-HJ-NPR-Z\d]+(?:\*|)|)$/.test(code)) {   // "*", "A*B", "A*", "*A", "*A*"
    //     return code.replace(/\*/g, '(.+)');
    } else if (/^(?=.*\*)[A-HJ-NPR-Z\d\*]*$/.test(code)) {   // Code with wildcard
        return code.replace(/\*/g, '(.+)');
    } else if (/^[A-HJ-NPR-Z\d]+$/.test(code) && length === code.length) {
        return code;
    }

    throw new IllegalCodeError(code);
}

/**
 * Cleans a decoded value against a code
 *
 * @param {ParameterizedValue} decodedValue
 * @param {String} code
 * @return {String}
 */
function validateDecodedValue(decodedValue, code) {
    const wildcardCount = (code.match(/\(\.\+\)/g) || []).length;
    const invalidRefs = [...decodedValue].filter(([_, ref]) => {
        return ref.index > wildcardCount
    });

    if (invalidRefs.length) {
        throw new ReferenceError(`Invalid wildcard reference: ${
            invalidRefs
                .map(([offset, { original }]) => `"${original}" at offset ${offset}`)
                .join(', ')
        } in decoded value "${decodedValue.original}" against "${code}"`);
    }
}

/**
 * Converts a conditional to an SQL compatible regular expression.
 *
 * @param {String} conditional
 * @return {Object}
 */
function parseConditional(conditional) {
    conditional = String(conditional).trim();

    if (/^not\s+(.+)/i.test(conditional)) {
        return {
            negate: true,
            pattern: parseConditional(RegExp.$1).pattern,
        };
    } else {
        return {
            negate: false,
            pattern: conditional
                .split(/\s*,\s*/g)
                .map(f => {
                    if (/^([A-HJ-NPR-Z\d]*)\*([A-HJ-NPR-Z\d]*)$/.test(f)) {
                        return `${RegExp.$1}.${RegExp.$2}`;
                    } else if (/^(\d+)\-(\d+)$/.test(f)) {
                        const start = Number.parseInt(RegExp.$1);
                        const end = Number.parseInt(RegExp.$2);

                        if (start > end) {
                            throw new IllegalConditionalError(f);
                        }

                        const range = [];

                        for (let i = start; i <= end; i++) {
                            range.push(i);
                        }

                        return range.join('|');
                    } else if (/^([A-HJ-NPR-Z]+)\-([A-HJ-NPR-Z]+)$/.test(f)) {
                        return createAlphaRange(RegExp.$1, RegExp.$2).join('|');
                    } else if (/^[A-HJ-NPR-Z\d]+$/.test(f)) {
                        return f;
                    }

                    throw new IllegalConditionalError(f);
                })
                .join('|'),
        };
    }
}

function convertAlphaToInteger(alpha) {
    return [...alpha.toUpperCase()]
        .map(c => c.charCodeAt(0) - 65)
        .reduce((s, c, i) => {
            return s + c * Math.pow(26, alpha.length - i - 1);
        }, 0)
    ;
}

function convertIntegerToAlpha(integer, length = 0) {
    const digits = [];

    while (integer >= 26) {
        digits.unshift(integer % 26);
        integer = Math.floor(integer / 26);
    }

    digits.unshift(integer);

    for (let i = 0, l = digits.length; i < length - l; i++) {
        digits.unshift(0);
    }

    return digits.map(d => String.fromCharCode(d + 65)).join('');
}

function createAlphaRange(from, to) {
    if (from.length !== to.length) {
        throw new RangeError(`Invalid range in conditional "${f}". The lengths must be the same. For example, A-Z, AA-ZZ, or AAA-ZZZ`);
    }

    const f = convertAlphaToInteger(from);
    const t = convertAlphaToInteger(to);

    if (f > t) {
        throw new RangeError(`Invalid range in conditional "${f}". The start value must not be greater than the end value`);
    }

    const l = to.length;

    const result = [];

    for (let i = f; i <= t; i++) {
        result.push(convertIntegerToAlpha(i, l));
    }

    return result;
}

/**
 * Parses the JSON from CSV.
 */
export default class Import {
    /**
     * Constructor
     */
    constructor(json) {
        // Contains errors
        this.$errors = new Set();

        // Contains warnings - for later use
        this.$warnings = new Set();

        this.$prepare(json);
    }

    /**
     * Validates the JSON object prior to import operation
     *
     * @param {JSON} json
     */
    $prepare(json) {
        if (!validateSchema(json)) {
            // console.log(jsonValidate.errors);
            this.$errors.add('JSON schema verification failed');
            return;
        }

        const aggr = json.Sections.reduce((aggr, section) => {
            section.range = new Range(section.StartPos, section.EndPos);
            section.hasConditional = !!(
                'string' === getTypeOf(section.AlwaysWhen) &&
                section.AlwaysWhen.length > 0 &&
                section.StartPosWhen &&
                section.EndPosWhen &&
                parseInt(section.StartPosWhen) <= parseInt(section.EndPosWhen)
            );

            section.headerKeys = section.Headers.map(h => {
                const headerLocations = aggr.headers.get(h) || [];
                
                if (!aggr.duplicateHeaders.has(h)) {
                    headerLocations.forEach(s => {
                        if (
                            s === section ||
                            !s.range.equals(section.range) ||
                            (s.range.equals(section.range) && (!s.hasConditional || !section.hasConditional))
                        ) {
                            aggr.duplicateHeaders.add(h);
                        }
                    });
                }

                headerLocations.push(section);
                aggr.headers.set(h, headerLocations);

                return h;
            });

            const key = section.range.toString();

            if (!aggr.sections.has(key)) {
                aggr.sections.set(key, section);
            } else if (!section.hasConditional || !aggr.sections.get(key).hasConditional) {
                this.errors.add(`Illegal section: ${section.range.toString()}`);
            }

            return aggr;
        }, {
            headers: new Map(),
            duplicateHeaders: new Set(),
            sections: new Map(),
        });

        const ranges = [...aggr.sections.values()].map(s => s.range);

        // Validate ranges
        for (let [r1, r2] of Range.overlaps(...ranges)) {
            this.$errors.add(`Overlapping sections: ${r1.toString()} and ${r2.toString()}`);
        }

        // Check for missing positions
        const flatRanges = flattenArray(ranges.map(r => [...r]));
        const missingPositions = [1, 2, 3, 4, 5, 6, /*7, 8,*/ 11].filter(p => !flatRanges.includes(p));

        if (missingPositions.length) {
            this.$errors.add(`Missing digits: ${missingPositions.join(', ')}`);
        }

        // Duplicate header check
        if (aggr.duplicateHeaders.size) {
            aggr.duplicateHeaders.forEach(header => {
                this.$errors.add(`Duplicate header "${header}" in sections ${aggr.headers.get(header).map(s => s.range.toString()).join(', ')}`);
            });
        }

        // If position ranges are not defined correctly, import MUST be canceled.
        if (this.hasErrors) {
            return;
        }

        // Year range covered by the JSON
        const overallYearRange = new Range(json.YearLesser, json.YearGreater);

        // Initialize the map.
        const outMap = {
            for: overallYearRange,
            sections: json.Sections.map((inSection, sectionIndex) => {
                const sectionHeaders = inSection.Headers;
    
                if (!sectionHeaders.length) {
                    this.$errors.add(`No headers in section ${inSection.range.toString()}`);
                }
    
                const sectionCharLength = inSection.EndPos - inSection.StartPos + 1;
                const outSection = {
                    headers: inSection.headerKeys,
                    for: inSection.range,
                };
    
                if (inSection.hasConditional) {
                    try {
                        outSection.when = {
                            for: new Range(inSection.StartPosWhen, inSection.EndPosWhen),
                            ...parseConditional(inSection.AlwaysWhen),
                        };
                    } catch (e) {
                        this.$errors.add(`${e.message} in section ${inSection.range.toString()}`);
                    }
                }

                outSection.variations = inSection.Rows.map((inSectionRow, sectionRowIndex) => {
                    const sectionValues = inSectionRow.DecodedValues.map(v => new ParameterizedValue(v));
                    const currentContext = `row ${sectionRowIndex} in section ${sectionIndex}(${inSection.range.toString()})`;
    
                    if (sectionHeaders.length != sectionValues.length) {
                        this.$errors.add(`The number of the decoded values does not match the number of the headers at ${currentContext}.`);
                    }
    
                    const variation = { values: sectionValues.map(v => v.normalized), choices: [] };
                    const codedValues = inSectionRow.CodedValues;
    
                    if (Array.isArray(codedValues)) {   // type: CodedValueStringCollection
                        // This case is only valid when the year range is finite.
                        if (overallYearRange.isInfinite) {
                            this.$errors.add(`Coded values are given as a string collection but the year range is open-ended at ${currentContext}.`);
                        } else if (overallYearRange.end - overallYearRange.start + 1 !== codedValues.length) {
                            // If we're given the coded values as a StringCollection
                            // the number of the values must match the number of years.
                            this.$errors.add(`Coded values are given as a string collection but the number of years does not match the number of the values at ${currentContext}.`);
                        } else { // If the collection is valid
                            if (codedValues.every(v => v == codedValues[0])) {
                                // If all of the items are the same we simply add indefinite range with the value.
                                try {
                                    variation.choices = [{
                                        pattern: parseCode(codedValues[0], sectionCharLength),
                                        for: new Range(null, null)
                                    }];
                                } catch (e) {
                                    e instanceof EmptyCodeError || this.$errors.add(`${e.message} at ${currentContext}`);
                                }
                            } else {    // type: Code
                                // Otherwise, we just give each value a year range.
                                variation.choices = codedValues.map((v, i) => {
                                    try {
                                        return {
                                            pattern: parseCode(v, sectionCharLength),
                                            for: new Range(i + overallYearRange.start, i + overallYearRange.start)
                                        };
                                    } catch (e) {
                                        e instanceof EmptyCodeError || this.$errors.add(`${e.message} at ${currentContext}`);
                                    }
                                }).filter(c => !!c);
                            }
                        }
                    } else {    // CodedValueString
                        try {
                            variation.choices = [{
                                pattern: parseCode(codedValues, sectionCharLength),
                                for: new Range(null, null)
                            }];
                        } catch (e) {
                            e instanceof EmptyCodeError || this.$errors.add(`${e.message} at ${currentContext}`);
                        }
                    }

                    if (variation.choices.length) {
                        variation.choices.forEach(({ pattern }) => {
                            sectionValues.forEach(pv => {
                                try {
                                    validateDecodedValue(pv, pattern);
                                } catch (e) {
                                    this.$errors.add(`${e.message} at ${currentContext}`);
                                }
                            });
                        });
                    } else {
                        this.$errors.add(`No valid code values found at ${currentContext}`);
                    }

                    return variation;
                });

                return outSection;
            }),
        };

        if (this.hasErrors) {
            return;
        }

        this.$map = outMap;
    }

    get map() {
        return this.$map;
    }

    get hasErrors() {
        return this.$errors.size > 0;
    }

    get hasWarnings() {
        return this.$warnings.size > 0;
    }

    get errors() {
        return this.$errors;
    }

    get warnings() {
        return this.$warnings;
    }
}
