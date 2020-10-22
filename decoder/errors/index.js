export class ParseError extends Error {}

export class EmptyCodeError extends ParseError {
    constructor(code) {
        super(`Empty code: "${code}"`);
        this.code = code;
    }
}

export class IllegalCodeError extends ParseError {
    constructor(code) {
        super(`Illegal code: "${code}"`);
        this.code = code;
    }
}

export class IllegalConditionalError extends ParseError {
    constructor(conditional) {
        super(`Illegal conditional: "${conditional}"`);
        this.conditional = conditional;
    }
}

