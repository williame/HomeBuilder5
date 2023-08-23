/* (c) William Edwards 2023 */

export function fail(message) {
    console.error(...arguments);
    throw new Error(message);
}

function getClassNameOrType(val) {
    return typeof val === "object"? val.constructor.name:
        typeof val === "function" && val.name? val.name:
        typeof val;
}

function isUndefined(val) {
    return typeof val === "undefined";
}

function shiftArguments(args, n=1) {
    return [].splice.call(args, n);
}

export function assertUndefined(val) {
    if(!isUndefined(val)) {
        fail("expected undefined, got " + getClassNameOrType(val), val, ...shiftArguments(arguments));
    }
}

export function assertTrue(condition) {
    if(!condition) {
        if(arguments.length === 1) {
            fail("a condition check failed");
        } else {
            fail(...shiftArguments(arguments));
        }
    }
}

export function assertFalse(condition) {
    if(condition) {
        if(arguments.length === 1) {
            fail("a condition check failed");
        } else {
            fail(...shiftArguments(arguments));
        }
    }
}

export function assertInstanceOf(obj, clz, canBeUndefined=false) {
    if (!((canBeUndefined && isUndefined(obj)) || obj instanceof clz)) {
        fail("expected " + getClassNameOrType(clz) + ", got " + getClassNameOrType(obj), obj, ...shiftArguments(arguments, 3));
    }
}

export function assertNumber(val, canBeUndefined=false) {
    if(!((canBeUndefined && isUndefined(val)) || typeof val === "number")) {
        fail("expected number, got " + getClassNameOrType(val), val, ...shiftArguments(arguments, 2));
    }
}