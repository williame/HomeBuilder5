/* (c) William Edwards 2023 */

export function fail(message) {
    console.error(...arguments);
    throw new Error(message);
}

export function getClassNameOrType(val) {
    return typeof val === "object"? val.constructor.name:
        typeof val === "function" && val.name? val.name:
        typeof val;
}

export function isUndefined(val) {
    return typeof val === "undefined";
}

function shiftArguments(args, n=1) {
    return [].splice.call(args, n);
}

export function assertNull(val) {
    if (val !== null) {
        fail("expected null, got", val, ...shiftArguments(arguments));
    }
    return null;
}

export function assertUndefined(val) {
    if(!isUndefined(val)) {
        fail("expected undefined, got " + getClassNameOrType(val), val, ...shiftArguments(arguments));
    }
    return undefined;
}

export function assertString(val, canBeUndefined=false) {
    if (canBeUndefined && isUndefined(val)) {
        return undefined;
    }
    assertTrue(typeof val === "string" || val instanceof String, ...shiftArguments(arguments));
    return val;
}

export function assertFunction(val) {
    assertTrue(typeof val === "function", ...shiftArguments(arguments));
    return val;
}

export function assertHomeBuilderId(id, prefix=undefined) {
    assertTrue(new RegExp("^" + (assertString(prefix, true) || ".*") + "_\\d+$").test(assertString(id)));
    return id;
}

export function assertTruthiness(condition) {
    if(!condition) {
        if(arguments.length === 1) {
            fail("a condition check failed");
        } else {
            fail(...shiftArguments(arguments));
        }
    }
    return condition;
}

export function assertTrue(val) {
    if (typeof val === "boolean" && val) {
        return true;
    }
    fail("expected a boolean true, got " + getClassNameOrType(val), val, ...shiftArguments(arguments));
}

export function assertFalsiness(condition) {
    if(condition) {
        if(arguments.length === 1) {
            fail("a condition check failed");
        } else {
            fail(...shiftArguments(arguments));
        }
    }
    return condition;
}

export function assertFalse(val) {
    if (typeof val === "boolean" && !val) {
        return false;
    }
    fail("expected a boolean false, got " + getClassNameOrType(val), val, ...shiftArguments(arguments));
}

export function assertInstanceOf(obj, clz, canBeUndefined=false) {
    if (canBeUndefined && isUndefined(obj)) {
        return undefined;
    }
    if (!Array.isArray(clz)) {
        clz = [clz];
    }
    for (const cls of clz) {
        assertTruthiness(typeof cls === "function", "expected function, got " + getClassNameOrType(cls), cls, ...shiftArguments(arguments, 3));
        if (obj instanceof cls) {
            return obj;
        }
    }
    fail("expected " + clz.map(getClassNameOrType).join("|") + ", got " + getClassNameOrType(obj), obj, ...shiftArguments(arguments, 3));
}

export function assertNumber(val, canBeUndefined=false) {
    if(!((canBeUndefined && isUndefined(val)) || typeof val === "number") || Number.isNaN(val)) {
        fail("expected number, got " + (Number.isNaN(val)? "NaN": getClassNameOrType(val)), val, ...shiftArguments(arguments, 2));
    }
    return val;
}

export function assertAbstractClass(newTarget, abstractClass) {
    assertFunction(abstractClass);
    assertTruthiness(newTarget !== abstractClass, abstractClass.name + " is abstract and cannot be be instantiated directly");
}