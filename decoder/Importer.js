import db from './mysql';
import Import from './Import';

/**
 * Imports JSON (replace if already exists)
 * 
 * @param {Object} json
 * @param {Boolean} validateOnly
 * @param {String} reference    VINE ID
 */
export async function put(json, validateOnly, reference) {
    const preparator = new Import(json);
    console.log('Put sql request started')

    if (preparator.hasErrors) {
        throw new Error([...preparator.errors].join('; '));
    }

    const map = preparator.map;

    const lookup = (await db.query(
        'INSERT INTO vin_lookup(start_year, end_year, section_count, reference) VALUES (?, ?, ?, ?)',
        [ map.for.start, map.for.end, map.sections.length, reference ]
    )).insertId;

    for (let section of map.sections) {
        console.log('mapping section');
        const sectionId = (await db.query(
            'INSERT INTO vin_sections(start_pos, end_pos, property_names, lookup_id, start_pos_when, end_pos_when, negate_when, pattern_when) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                section.for.start,
                section.for.end,
                JSON.stringify(section.headers),
                lookup,
                section.when ? section.when.for.start : null,
                section.when ? section.when.for.end : null,
                section.when ? section.when.negate : null,
                section.when ? section.when.pattern : null,
            ]
        )).insertId;

        for (let variation of section.variations) {
            console.log('mapping variations');
            const variationId = (await db.query(
                'INSERT INTO vin_section_variations(property_values, section_id) VALUES (?, ?)',
                [ JSON.stringify(variation.values), sectionId ]
            )).insertId;

            for (let choice of variation.choices) {
                console.log('mapping choices')
                if (choice.pattern) {
                    await db.query(
                        'INSERT INTO vin_section_variation_choices(start_year, end_year, code_value, variation_id) VALUES (?, ?, ?, ?)',
                        [ choice.for.start, choice.for.end, choice.pattern, variationId ]
                    );
                }
            }
        }
    }
}

/**
 * Removes JSON by reference (VINE ID)
 * 
 * @param {String} reference 
 */
export async function remove(reference) {
    await db.query(`DELETE FROM vin_lookup WHERE reference = ?`, [reference]);
}
