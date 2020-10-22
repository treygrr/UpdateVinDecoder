export default class ParameterizedValue {
    constructor(value) {
        const re = /\{\d+\}/g;
        const references = new Map();
        let match;

        while (null !== (match = re.exec(value))) {
            const index = parseInt(match[0].slice(1, -1));
            references.set(
                match.index, Object.freeze({
                    original: match[0], index, normalized: `{${index}}`
                })
            );
        }
        
        this.normalized = value.replace(re, (_, offset) => {
            return `{${references.get(offset).index}}`;
        });

        this.references = references;
        this.original = value;
    }

    toString() {
        return this.normalizedValue;
    }

    *[Symbol.iterator]() {
        yield *this.references;
    }
}