/**
 * Returns the string representation of the type of a variable
 * string, number, null, undefined, object, function etc
 *
 * @param {*} variable
 * @return {String}
 */
export function getTypeOf(variable) {
    return Object.prototype.toString.call(variable).replace(/\[object (.+)\]/, '$1').toLowerCase();
}

/**
 * Flattens an array.
 *
 * @param {Array} arr
 */
export function flattenArray(arr) {
    if (Array.isArray(arr)) {
        return arr.reduce((flat, elem) => {
            return flat.concat(flattenArray(elem));
        }, []);
    } else {
        return [arr];
    }
}
