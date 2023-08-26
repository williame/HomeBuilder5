
import * as THREE from 'three';
import * as asserts from "../asserts.js";
import {World} from "./world.js";
import {assertInstanceOf} from "../asserts.js";

export class CommandHandler {
    constructor(world) {
        asserts.assertInstanceOf(world, World);
        asserts.assertAbstractClass(new.target, CommandHandler);
        asserts.assertFunction(this["execute"], this.constructor.name + ".execute");
        asserts.assertFunction(this["undo"], this.constructor.name + ".undo");
        this.world = world;
        this.world.editLog.register(this);
    }

    add(command) {
        return this.world.editLog.add(this, command);
    }
}

class EditAction {
    constructor(commandHandler, command) {
        asserts.assertInstanceOf(commandHandler, CommandHandler);
        this.command = command;
        this.commandHandler = commandHandler;
        this.json = JSON.stringify(command);
        // check that our object is stringifies nicely
        asserts.assertTruthiness(this.json === JSON.stringify(JSON.parse(this.json)), "json command didn't round-trip", command, this.json);
    }

    execute() {
        return this.commandHandler.execute(this.command);
    }

    undo() {
        this.commandHandler.undo(this.command);
    }
}

class TransactionMarker {
    static idSeq = 1;
    constructor(name) {
        this.name = name;
        this.id = TransactionMarker.idSeq++;
    }
}

export class EditLog {

    constructor(world) {
        asserts.assertInstanceOf(world, World);
        this.log = [];
        this.inTransaction = false;
        this.commandHandlers = {}
        this.length = 0;
    }

    register(commandHandler) {
        asserts.assertFalsiness(this.commandHandlers.hasOwnProperty(commandHandler.constructor.name), commandHandler);
        this.commandHandlers[commandHandler.constructor.name] = commandHandler;
    }

    begin(name) {
        asserts.assertString(asserts.assertTruthiness(name));
        asserts.assertFalse(this.inTransaction, "begin(" + name + ") in open transaction");
        this.log.length = this.length;
        const marker = new TransactionMarker(name);
        this.log.push(marker);
        this.length++;
        this.inTransaction = true;
        return marker.id;
    }

    add(commandHandler, command) {
        asserts.assertInstanceOf(commandHandler, CommandHandler);
        const commandName = commandHandler.constructor.name;
        asserts.assertTrue(this.commandHandlers.hasOwnProperty(commandName));
        asserts.assertTrue(this.inTransaction, "add(" + commandName + ") not in open transaction", command);
        const prevAction = this.log[this.length - 1];
        // previous action is of same type and supports merging?
        if (prevAction instanceof EditAction && prevAction.merge) {
            // see if we can merge it
            const mergedCommandAndHandler = prevAction.merge(prevAction.command, commandName, command);
            if (mergedCommandAndHandler) {
                const newCommandHandler = assertInstanceOf(mergedCommandAndHandler["handler"], CommandHandler);
                asserts.assertTrue(this.commandHandlers.hasOwnProperty(newCommandHandler.constructor.name));
                const action = new EditAction(newCommandHandler, mergedCommandAndHandler.command);
                this.log[this.log.length - 1] = action;
                return action.execute();
            }
        }
        const action = new EditAction(commandHandler, command);
        this.log.push(action);
        this.length++;
        return action.execute();
    }

    canUndo() {
        return !this.inTransaction && this.length;
    }

    undo() {
        asserts.assertFalse(this.inTransaction, "undo() cannot occur in open transaction");
        asserts.assertTruthiness(this.length, "nothing to undo()");
        while (this.length --> 0) {
            const entry = this.log[this.length];
            if (entry instanceof TransactionMarker) {
                break;
            }
            asserts.assertInstanceOf(entry, EditAction).undo();
        }
    }

    canRedo() {
        return !this.inTransaction && this.length < this.log.length;
    }

    redo() {
        asserts.assertFalse(this.inTransaction, "redo() cannot occur in open transaction");
        asserts.assertTruthiness(this.length < this.log.length, "nothing to redo()");
        while (++this.length < this.log.length) {
            const entry = this.log[this.length];
            if (entry instanceof TransactionMarker) {
                break;
            }
            asserts.assertInstanceOf(entry, EditAction).execute();
        }
    }

    commit(id) {
        asserts.assertTrue(this.inTransaction, "commit(" + id + ") not in open transaction");
        asserts.assertTrue(this.length === this.log.length, "internal error: length " + this.length + " != " + this.log.length);
        this.inTransaction = false;
        for (let i = this.length; i --> 0; ) {
            const entry = this.log[i];
            if (entry instanceof TransactionMarker) {
                asserts.assertTrue(id === entry.id, id, entry.name, entry.id);
                return;
            }
        }
        asserts.fail("unexpected");
    }

    rollback(id) {
        while (this.length --> 0) {
            const entry = this.log[this.length];
            if (entry instanceof TransactionMarker) {
                asserts.assertTrue(id === entry.id, "expected " + id + ", got " + entry.id + "," + entry.name);
                break;
            }
            asserts.assertInstanceOf(entry, EditAction).undo();
        }
        this.log.length = this.length;
        this.inTransaction = false;
    }
}

export class Serialize {

    static #numberScale = 100000000; // TODO the scene should be in whole units instead?

    static fromVector3(vec3) {
        asserts.assertInstanceOf(vec3, THREE.Vector3);
        return {x: this.toNumber(vec3.x), y: this.toNumber(vec3.y), z: this.toNumber(vec3.z)};
    }

    static toVector3(obj) {
        return new THREE.Vector3(this.fromNumber(obj.x), this.fromNumber(obj.y), this.fromNumber(obj.z));
    }

    static toNumber(val) {
        return Math.round(asserts.assertNumber(val) * this.#numberScale);
    }

    static fromNumber(val) {
        return asserts.assertNumber(val) / this.#numberScale;
    }
}