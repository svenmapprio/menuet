"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntForce = exports.waitUntil = void 0;
const waitUntil = (promise, delay = 500) => __awaiter(void 0, void 0, void 0, function* () {
    let v = null;
    const get = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            v = (_a = yield promise().catch(() => { })) !== null && _a !== void 0 ? _a : null;
            if (!v)
                yield new Promise(res => setTimeout(res, delay));
        }
        catch (_b) {
        }
    });
    while (!v)
        yield get();
    return v;
});
exports.waitUntil = waitUntil;
const parseIntForce = (int) => {
    const parsed = parseInt(int);
    return isNaN(parsed) ? null : parsed;
};
exports.parseIntForce = parseIntForce;
