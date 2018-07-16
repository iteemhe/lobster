import * as Util from "../util/util";
import {CPPConstruct} from "./constructs";
import {CPPError} from "./errors";
import {Value, RawValueType, byte} from "./runtimeEnvironment";
import {Description} from "./errors";
import { CPPObject } from "./objects";
				
var vowels = ["a", "e", "i", "o", "u"];
function isVowel(c: string) {
	return vowels.indexOf(c) != -1;
};




export class TypeSpecifier extends CPPConstruct {

    public compile() {

        let constCount = 0;
        let volatileCount = 0;

        let specs = this.ast;

        for(var i = 0; i < specs.length; ++i){
            var spec = specs[i];
            if(spec === "const"){
                if(this.isConst) {
                    this.addNote(CPPError.type.const_once(this));
                }
                else{
                    this.isConst = true;
                }
            }
            else if(spec === "volatile"){
                if (this.volatile){
                    this.addNote(CPPError.type.volatile_once(this));
                }
                else{
                    this.volatile = true;
                }
            }
            else if (spec === "unsigned"){
                if (this.unsigned){
                    this.addNote(CPPError.type.unsigned_once(this));
                }
                else if (this.signed){
                    this.addNote(CPPError.type.signed_unsigned(this));
                }
                else{
                    this.unsigned = true;
                }
            }
            else if (spec === "signed"){
                if (this.signed){
                    this.addNote(CPPError.type.signed_once(this));
                }
                else if (this.unsigned){
                    this.addNote(CPPError.type.signed_unsigned(this));
                }
                else{
                    this.signed = true;
                }
            }
            else{ // It's a typename
                if (this.typeName){
                    this.addNote(CPPError.type.one_type(this));
                }
                else{
                    // TODO will need to look up the typename in scope to check it
                    this.typeName = spec;
                }
            }
        }

        // If we don't have a typeName by now, it means there wasn't a type specifier
        if (!this.typeName){
            this.addNote(CPPError.declaration.func.no_return_type(this));
            return;
        }

        if (this.unsigned){
            if (!this.typeName){
                this.typeName = "int";
            }
            this.addNote(CPPError.type.unsigned_not_supported(this));
        }
        if (this.signed){
            if (!this.typeName){
                this.typeName = "int";
            }
        }

        if (builtInTypes[this.typeName]){
			this.type = builtInTypes[this.typeName].instance(this.isConst, this.isVolatile);
            return;
		}

        var scopeType;
        if (scopeType = this.contextualScope.lookup(this.typeName)){
            if (scopeType instanceof TypeEntity){
                this.type = scopeType.type.instance(this.isConst, this.isVolatile);
                return;
            }
        }

        this.type = Unknown.instance();
        this.addNote(CPPError.type.typeNotFound(this, this.typeName));
	}
};

export var userTypeNames = {};
export var builtInTypes : {[index:string]: Util.Constructor} = {};

export var defaultUserTypeNames = {
    ostream : true,
    istream : true,
    size_t : true
};

export function sameType(type1: Type, type2: Type) {
    return type1 && type2 && type1.sameType(type2);
};

export function similarType(type1: Type, type2: Type) {
    return type1 && type2 && type1.similarType(type2);
};

// TODO subType function is dangerous :(
export function subType(type1: Type, type2: Type) {
    return type1 instanceof ClassType && type2 instanceof ClassType && type1.isDerivedFrom(type2);
};

export var covariantType = function(derived: Type, base: Type){
    if (sameType(derived, base)){
        return true;
    }

    var dc;
    var bc;
    if (derived instanceof Pointer && base instanceof Pointer){
        dc = derived.ptrTo;
        bc = base.ptrTo;
    }
    else if (derived instanceof Reference && base instanceof Reference){
        dc = derived.refTo;
        bc = base.refTo;
    }
    else{
        return false; // not both pointers or both references
    }

    // Must be pointers or references to class type
    if (!(dc instanceof ClassType) || !(bc instanceof ClassType)){
        return false;
    }

    // dc must be derived from bc
    if (!dc.isDerivedFrom(bc)){
        return false;
    }

    // Pointers/References must have the same cv-qualification
    if (derived.isConst != base.isConst || derived.isVolatile != base.isVolatile){
        return false;
    }

    // dc must have same or less cv-qualification as bc
    if (dc.isConst && !bc.isConst || dc.isVolatile && !bc.isVolatile){
        return false;
    }

    // Yay we made it!
    return true;
};

export var referenceCompatible = function(from: Type, to: Type){
    return from && to && from.isReferenceCompatible(to);
};

export var noRef = function(type : Type){
    if(type instanceof Reference){
        return type.refTo;
    }
    else{
        return type;
    }
};

export var isCvConvertible = function(t1: Type, t2: Type){

    // t1 and t2 must be similar
    if (!similarType(t1,t2)){ return false; }

    // Discard 0th level of cv-qualification signatures, we don't care about them.
    // (It's essentially a value semantics thing, we're making a copy so top level const doesn't matter.)
    t1 = t1.getCompoundNext();
    t2 = t2.getCompoundNext();

    // check that t2 has const everywhere that t1 does
    // also if we ever find a difference, t2 needs const everywhere leading
    // up to it (but not including) (and not including discarded 0th level).
    var t2AllConst = true;
    while(t1 && t2){ //similar so they should run out at same time
        if (t1.isConst && !t2.isConst){
            return false;
        }
        else if (!t1.isConst && t2.isConst && !t2AllConst){
            return false;
        }

        // Update allConst
        t2AllConst = t2AllConst && t2.isConst;
        t1 = t1.getCompoundNext();
        t2 = t2.getCompoundNext();
    }

    // If no violations, t1 is convertable to t2
    return true;
};

// interface DefaultTypeProperties {
//     size: number;
//     precedence: number;
//     isObjectType?: boolean;
//     isArithmeticType?: boolean;
//     isIntegralType?: boolean;
//     isFloatingPointType?: boolean;
//     isComplete?: boolean;
// }

export class Type {
    public static readonly _name = "Type";

    public abstract readonly size: number;

    /**
     * Used in parenthesization of string representations of types.
     * e.g. Array types have precedence 2, whereas Pointer types have precedence 1.
     */
    protected abstract readonly precedence: number;


    // All these use the definite assignment assertion because they are initialized as default properties on the prototype
    public readonly isObjectType!: boolean;
    public readonly isArithmeticType!: boolean;
    public readonly isIntegralType!: boolean;
    public readonly isFloatingPointType!: boolean;
    public readonly isComplete!: boolean;

    // Set the default properties above
    protected static readonly _defaultProps = Util.addDefaultProperties(
        Type,
        {
            isObjectType: false,
            isArithmeticType: false,
            isIntegralType: false,
            isFloatingPointType: false,
            isComplete: false
        }
    );

    // regular member properties
    public readonly isConst: boolean;
    public readonly isVolatile: boolean;

    public constructor(isConst: boolean = false, isVolatile: boolean = false) {
        this.isConst = isConst;
        // TODO ignore volatile completely? for now (and perhaps forever lol)
        this.isVolatile = isVolatile;
    }

    public getCVString() {
        return (this.isConst ? "const " : "") + (this.isVolatile ? "volatile " : "");
    }

    public toString() {
        return this.typeString(false, "");
    }

    /**
     * Returns true if other represents exactly the same type as this, including cv-qualifications.
     * @param other
     */
    public abstract sameType(other: Type) : boolean;

    /**
     * Returns true if other represents the same type as this, ignoring cv-qualifications.
     * @param other
     */
    public abstract similarType(other: Type) : boolean;


    /**
     * Returns true if this type is reference-related (see C++ standard) to the type other.
     * @param other
     */
    public isReferenceRelated(other: Type) {
        return sameType(this.cvUnqualified(), other.cvUnqualified()) ||
            subType(this.cvUnqualified(),other.cvUnqualified());
    }

    /**
     * Returns true if this type is reference-compatible (see C++ standard) to the type other.
     * @param {Type} other
     * @returns {boolean}
     */
    public isReferenceCompatible(other: Type) {
        return this.isReferenceRelated(other) && (other.isConst || !this.isConst) && (other.isVolatile || !this.isVolatile);
    }

    /**
     * Returns a C++ styled string representation of this type.
     * @param excludeBase If true, exclude the base type.
     * @param varname The name of the variable. May be the empty string.
     * @param decorated If true, html tags will be added.
     */
    public abstract typeString(excludeBase: boolean, varname: string, decorated?: boolean) : string;

    /**
     * Returns a C++ styled string representation of this type, with the base type excluded as
     * would be suitable for only printing the declarator part of a declaration.
     * @param varname The name of the variable. May be the empty string.
     */
    public declaratorString(varname: string) {
        return this.typeString(true, varname);
    }

    /**
     * Returns a string representing a type as it might be read verbally in english.
     * e.g. int const * var[5] --> "an array of 5 pointers to const int"
     * @param plural Whether the returned string should be plural.
     */
    public abstract englishString(plural: boolean) : string;

    /**
     * Helper function for functions that create string representations of types.
     */
    protected parenthesize(outside: Type, str: string) {
        return this.precedence < outside.precedence ? "(" + str + ")" : str;
    }

    /**
     * Returns a human-readable string representation of the given raw value for this Type.
     * This is the representation that might be displayed to the user when inspecting the
     * value of an object.
     * Note that the value representation for the type in Lobster is just a javascript
     * value. It is not the C++ value representation for the type.
     * @param value
     */
    public abstract valueToString(value: RawValueType) : string;

    /**
     * Returns the string representation of the given raw value for this Type that would be
     * printed to an ostream.
     * Note that the raw value representation for the type in Lobster is just a javascript
     * value. It is not the C++ value representation for the type.
     * TODO: This is a hack that may eventually be removed since printing to a stream should
     * really be handled by overloaded << operator functions.
     * @param value
     */
    public valueToOstreamString(value: RawValueType) {
        return this.valueToString(value);
    }

    /**
     * Both the name and message are just a C++ styled string representation of the type.
     * @returns {{name: {String}, message: {String}}}
     */
    public describe() : Description {
        var str = this.typeString(false, "");
        return {name: str, message: str};
    }

    /**
     * Converts a sequence of bytes (i.e. the C++ object representation) of a value of
     * this type into the raw value used to represent it internally in Lobster (i.e. a javascript value).
     * TODO: Right now, the hack that is used is that the whole value
     * @param bytes
     */
    public bytesToValue(bytes: byte[]){
        // HACK: the whole value is stored in the first byte
        return bytes[0];
    }

    /**
     * Converts a raw value representing a value of this type to a sequence of bytes
     * (i.e. the C++ object representation)
     * @param value
     */
    public valueToBytes(value: RawValueType) {
        var bytes = [];
        // HACK: store the whole value in the first byte and zero out the rest. thanks javascript :)
        bytes[0] = value;
        for(var i = 1; i < this.size-1; ++i){
            bytes.push(0);
        }
        return <byte[]>bytes;
    }

    /**
     * Returns whether a given raw value for this type is valid. For example, a pointer type may track runtime
     * type information about the array from which it was originally derived. If the pointer value increases such
     * that it wanders over the end of that array, its value becomes invalid.
     * @param value
     */
    public abstract isValueValid(value: RawValueType) : boolean;

    /**
     * If this is a compound type, returns the "next" type.
     * e.g. if this is a pointer-to-int, returns int
     * e.g. if this ia a reference to pointer-to-int, returns int
     * e.g. if this is an array of bool, returns bool
     */
    public getCompoundNext() : Type | null {
        return null;
    }

    /**
     * Returns true if this type is either const or volatile (or both)
     * @returns {boolean}
     */
    public isCVQualified() {
        return this.isConst || this.isVolatile;
    }

    /**
     * Returns a cv-unqualified proxy object for this type, unless this type was already cv-unqualified,
     * in which case just returns this object.
     * @returns {Type}
     */
    public cvUnqualified() {
        if (!this.isCVQualified()){
            return this;
        }
        else {
            var proxy = Object.create(this);
            proxy.isConst = false;
            proxy.isVolatile = false;
            return proxy;
        }
    }

    /**
     * Returns a proxy object for this type with the specified cv-qualifications, unless this type already matches
     * the given cv-qualifications, in which case just returns this object.
     * @returns {Type}
     */
    public cvQualified(isConst: boolean, isVolatile: boolean) {
        if (this.isConst == isConst && this.isVolatile == isVolatile){
            return this;
        }
        else{
            var proxy = Object.create(this);
            proxy.isConst = isConst;
            proxy.isVolatile = isVolatile;
            return proxy;
        }
    }
};

/**
 * Used when a compilation error causes an unknown type.
 */
export class Unknown extends Type {

    public readonly size!: number;
    protected readonly precedence!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Unknown,
        {
            size: 0,
            precedence: 0
        }
    );

    public sameType(other: Type) : boolean {
        return false;
    }

    public similarType(other: Type) : boolean{
        return false;
    }

	public typeString(excludeBase: boolean, varname: string, decorated: boolean) {
        return "<unknown>";
    }
    
	public englishString(plural: boolean) {
		return "an unknown type";
    }
    
	public valueToString(value: RawValueType) {
        Util.assert(false);
        return "";
    }
    
    public isValueValid(value: RawValueType) {
        return false;
    }
}

builtInTypes["unknown"] = Unknown;

export class Void extends Type {

    protected readonly simpleType!: string;
    public readonly size!: number;
    protected readonly precedence!: number;
    protected static readonly _defaultProps = Util.addDefaultProperties(
        Void,
        {
            simpleType: "void",
            size: 0,
            precedence: 0
        }
    );

    public sameType(other: Type) : boolean {
        return other instanceof Void
            && other.isConst === this.isConst
            && other.isVolatile === this.isVolatile;
    }

    public similarType(other: Type) : boolean{
        return other instanceof Void;
    }

	public typeString(excludeBase: boolean, varname: string, decorated: boolean) {
        return "void";
    }
    
	public englishString(plural: boolean) {
		return "void";
    }
    
	public valueToString(value: RawValueType) {
        Util.assert(false);
        return "";
    }
    
    public isValueValid(value: RawValueType) {
        return false;
    }
}
builtInTypes["void"] = Void;

export abstract class SimpleType extends Type {
    
    /**
     * Subclasses must implement a concrete type property that should be a
     * string indicating the kind of type e.g. "int", "double", "bool", etc.
     */
    protected abstract simpleType: string;

    public readonly isComplete!: boolean;
    protected readonly precedence!: number;
    protected static readonly _defaultProps = Util.addDefaultProperties(
        SimpleType,
        {
            isComplete: true,
            precedence: 0
        }
    );

    public sameType(other: Type) : boolean {
        return other instanceof SimpleType
            && other.simpleType === this.simpleType
            && other.isConst === this.isConst
            && other.isVolatile === this.isVolatile;
    }

    public similarType(other: Type) : boolean{
        return other instanceof SimpleType
            && other.simpleType === this.simpleType;
    }

	public typeString(excludeBase: boolean, varname: string, decorated: boolean) {
        if (excludeBase) {
            return varname ? varname : "";
        }
        else{
            return this.getCVString() + (decorated ? Util.htmlDecoratedType(this.simpleType) : this.simpleType) + (varname ? " " + varname : "");
        }
    }
    
	public englishString(plural: boolean) {
		// no recursive calls to this.simpleType.englishString() here
		// because this.simpleType is just a string representing the type
        var word = this.getCVString() + this.simpleType;
		return (plural ? this.simpleType+"s" : (isVowel(word.charAt(0)) ? "an " : "a ") + word);
    }
    
	public valueToString(value: RawValueType) {
		return ""+value;
    }
    
    public isValueValid(value: RawValueType) {
        return true;
    }
}



// TODO: This was an idea for a hack to store C++ object data into a javascript object. I don't think it's going to be used anywhere.
// var _Universal_data = SimpleType.extend({
//     _name: "_Universal_data",
//     simpleType: "_universal_data",
//     size: 16
// });
// builtInTypes["_universal_data"] = _Universal_data;

abstract class IntegralTypeBase extends SimpleType {

    public readonly isIntegralType!: boolean;
    public readonly isArithmeticType!: boolean;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        IntegralTypeBase,
        {
            isIntegralType: true,
            isArithmeticType: true
        }
    );
}


export class Char extends IntegralTypeBase {
    
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Char,
        {
            simpleType: "char",
            size: 1
        }
    );

    public static readonly NULL_CHAR = 0;

    public static isNullChar(value: RawValueType) {
        return value === this.NULL_CHAR;
    }

    public jsStringToNullTerminatedCharArray(str: string) {
        var chars = str.split("").map(function(c){
            return c.charCodeAt(0);
        });
        chars.push(Char.NULL_CHAR);
        return chars;
    }

    public valueToString(value: RawValueType) {
        // use <number> assertion based on the assumption this will only be used with proper raw values that are numbers
        return "'" + Util.unescapeString(String.fromCharCode(<number>value)) + "'";//""+value;
    }
    public valueToOstreamString(value: RawValueType) {
        // use <number> assertion based on the assumption this will only be used with proper raw values that are numbers
        return String.fromCharCode(<number>value);
    }
}
builtInTypes["char"] = Char;

export class Int extends IntegralTypeBase {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Int,
        {
            simpleType: "int",
            size: 4
        }
    );
};

builtInTypes["int"] = Int;

export class Size_t extends IntegralTypeBase {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Size_t,
        {
            simpleType: "size_t",
            size: 8
        }
    );
}
builtInTypes["size_t"] = Size_t;

export class Bool extends IntegralTypeBase {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Bool,
        {
            simpleType: "bool",
            size: 1
        }
    );
}
builtInTypes["bool"] = Bool;

// TODO: add support for Enums



abstract class FloatingPointTypeBase extends SimpleType {



    public readonly isFloatingPointType!: boolean;
    public readonly isArithmeticType!: boolean;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        FloatingPointTypeBase,
        {
            isFloatingPointType: true,
            isArithmeticType: true
        }
    );

    public valueToString(value: RawValueType) {
        // use <number> assertion based on the assumption this will only be used with proper raw values that are numbers
        var str = ""+<number>value;
        return str.indexOf(".") != -1 ? str : str + ".";
    }
}

export class Float extends FloatingPointTypeBase {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Float,
        {
            simpleType: "float",
            size: 4
        }
    );
}
builtInTypes["float"] = Float;

export class Double extends FloatingPointTypeBase {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Double,
        {
            simpleType: "double",
            size: 8
        }
    );
}
builtInTypes["double"] = Double;

export class OStream extends SimpleType {
    protected readonly simpleType!: string;
    public readonly size!: number;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        OStream,
        {
            simpleType: "ostream",
            size: 4
        }
    );

    // public valueToString(value: RawValueType){
    //     return JSON.stringify(value);
    // }
}
builtInTypes["ostream"] = OStream;

// TODO: add support for istream
// export class IStream = SimpleType.extend({
//     _name: "IStream",
//     simpleType: "istream",
//     size: 4,

//     valueToString : function(value){
//         return JSON.stringify(value);
//     }
// });
// builtInTypes["istream"] = IStream;





//TODO: create separate function pointer type???

export class Pointer extends Type {

    public readonly size!: number;
    protected readonly precedence!: number;
    public readonly isComplete!: boolean;

    protected static readonly _defaultProps = Util.addDefaultProperties(
        Pointer,
        {
            size: 8,
            precedence: 1,
            isComplete: true
        }
    );

    public static isNull(value: RawValueType) {
        return <number>value === 0;
    }

    public static isNegative(value: RawValueType) {
        return <number>value < 0;
    }

    public readonly ptrTo: Type;

    public constructor(ptrTo: Type, isConst?: boolean, isVolatile?: boolean) {
        super(isConst, isVolatile);
        this.ptrTo = ptrTo;
    }

    public getCompoundNext() {
        return this.ptrTo;
    }

    public sameType(other: Type) : boolean {
        return other instanceof Pointer
            && this.ptrTo.sameType(other.ptrTo)
            && other.isConst === this.isConst
            && other.isVolatile === this.isVolatile;
    }

    similarType(other: Type) : boolean {
        return other instanceof Pointer
            && this.ptrTo.similarType(other.ptrTo);
    }

    public typeString(excludeBase: boolean, varname: string, decorated: boolean) {
        return this.ptrTo.typeString(excludeBase, this.parenthesize(this.ptrTo, this.getCVString() + "*" + varname), decorated);
    }

    public englishString(plural: boolean) {
        return (plural ? this.getCVString()+"pointers to" : "a " +this.getCVString()+"pointer to") + " " + this.ptrTo.englishString();
    }

    public valueToString(value: RawValueType) {
        if (this.ptrTo instanceof FunctionType && value) {
            return value.name;
        }
        else{
            return "0x" + value;
        }
    }

    public isObjectPointer() {
        return this.ptrTo.isObjectType || this.ptrTo instanceof Void;
    }

    /**
     * Returns whether a given raw value for this type is dereferenceable. For pointer types, the given raw value is dereferenceable
     * if the result of the dereference will be a live object. An example of the distinction between validity and
     * dereferenceability for pointer types would be an array pointer. The pointer value (an address) is dereferenceable
     * if it is within the bounds of the array. It is valid in those same locations plus also the location one space
     * past the end (but not dereferenceable there). All other address values are invalid.
     * @param value
     */
    public isValueDereferenceable(value: RawValueType) {
        return this.isValueValid(value);
    }
}

export class ArrayPointer extends Pointer {
    
    public readonly arrayObject: CPPObject;

    public constructor(arrayObject: CPPObject, isConst?: boolean, isVolatile?: boolean) {
        super(arrayObject.type.elemType, isConst, isVolatile);
        this.arrayObject = arrayObject;
    }

    public min() {
        return this.arrayObject.address;
    }

    public onePast() {
        return this.arrayObject.address + this.arrayObject.type.properSize;
    }

    public isValueValid(value: RawValueType) {
        if (!this.arrayObject.isAlive){
            return false;
        }
        var arrayObject = this.arrayObject;
        return arrayObject.address <= value && value <= arrayObject.address + arrayObject.type.properSize;
    }

    public isValueDereferenceable(value: RawValueType) {
        return this.isValueValid(value) && value !== this.onePast();
    }

    public toIndex(addr: number) {
        return Util.integerDivision(addr - this.arrayObject.address, this.arrayObject.type.elemType.size);
    }

}

export class ObjectPointer extends Pointer {
    
    public readonly pointedObject: CPPObject;

    public constructor(obj: CPPObject, isConst?: boolean, isVolatile?: boolean) {
        super(obj.type, isConst, isVolatile);
        this.pointedObject = obj;
    }

    public getPointedObject() {
        return this.pointedObject;
    }
    
    public isValueValid(value: RawValueType) {
        return this.pointedObject.isAlive && this.pointedObject.address === value;
    }

}


// REQUIRES: refTo must be a type
export class Reference extends Type {
    _name: "Reference",
    isObjectType: false,
    i_precedence: 1,
    _isComplete: true,

    init: function(refTo, isConst, isVolatile){
        // References have no notion of const (they can't be re-bound anyway)
        this.initParent(false, isVolatile);
        this.refTo = refTo;
        this.size = this.refTo.size;
        return this;
    },

    getCompoundNext : function() {
        return this.refTo;
    },

    sameType : function(other){
        return other.isA(Reference) && this.refTo.sameType(other.refTo);
    },
    //Note: I don't think similar types even make sense with references. See spec 4.4
    similarType : function(other){
        return other.isA(Reference) && this.refTo.similarType(other.refTo);
    },
    typeString : function(excludeBase, varname, decorated){
		return this.refTo.typeString(excludeBase, this.i_parenthesize(this.refTo, this.getCVString() + "&" + varname), decorated);
	},
	englishString : function(plural){
		return this.getCVString() + (plural ? "references to" : "a reference to") + " " + this.refTo.englishString();
	},
	valueToString : function(value){
		return ""+value;
	}
});


// REQUIRES: elemType must be a type
var ArrayType = Type.extend({
    _name: "Array",
    i_precedence: 2,
    _isComplete: true, // Assume complete. If length is unknown, individual Array types will set to false
    init: function(elemType, length, isConst, isVolatile){

        if (length === undefined){
            this._isComplete = false;
        }

        // Set size before initParent since that assumes size is what it should be when it runs
        this.properSize = elemType.size * length;
        this.size = Math.max(1, this.properSize);

        this.initParent(elemType.isConst, elemType.isVolatile);
        this.elemType = elemType;
        this.length = length;
        return this;
    },

    getCompoundNext : function() {
        return this.elemType;
    },

    setLength : function(length){
        this.length = length;
        this.properSize = this.elemType.size * length;
        this.size = Math.max(1, this.properSize);
        if (this.size > Type.getMaxSize()){
            Type.setMaxSize(this.size);
        }
    },
    sameType : function(other){
        return other.isA(ArrayType) && this.elemType.sameType(other.elemType) && this.length === other.length;
    },
    similarType : function(other){
        return other.isA(ArrayType) && this.elemType.similarType(other.elemType) && this.length === other.length;
    },
    typeString : function(excludeBase, varname, decorated){
		return this.elemType.typeString(excludeBase, varname +  "["+(this.length !== undefined ? this.length : "")+"]", decorated);
	},
	englishString : function(plural){
		return (plural ? "arrays of " : "an array of ") + this.length + " " + this.elemType.englishString(this.length > 1);
	},
	valueToString : function(value){
		return ""+value;
	},
    bytesToValue : function(bytes){
        var arr = [];
        var elemSize = this.elemType.size;
        for(var i = 0; i < bytes.length; i += elemSize){
            arr.push(this.elemType.bytesToValue(bytes.slice(i, i + elemSize)));
        }
        return arr;
    },
    valueToBytes : function(value){
        var bytes = [];
        for(var i = 0; i < value.length; ++i){
            bytes.pushAll(this.elemType.valueToBytes(value[i]));
        }
        return bytes;
    }
});
export {ArrayType as Array};


/**
 * memberEntities - an array of all member entities. does not inlcude constructors, destructor, or base class subobject entities
 * subobjectEntities - an array containing all subobject entities, include base class subobjects and member subobjects
 * baseClassSubobjectEntities - an array containing entities for any base class subobjects
 * memberSubobjectEntities - an array containing entities for member subobjects (does not contain base class subobjects)
 * constructors - an array of the constructor entities for this class. may be empty if no constructors
 * copyConstructor - the copy constructor entity for this class. might be null if doesn't have a copy constructor
 * destructor - the destructor entity for this class. might be null if doesn't have a destructor
 */
var ClassType = Type.extend({
    _name: "Class",
    i_precedence: 0,
    className: Class._ABSTRACT,
    _nextClassId: 0,

    createClassType : function(name, parentScope, base, members) {
        assert(this == ClassType); // shouldn't be called on instances
        var classType = this.extend({
            _name : name,
            i_classId : this._nextClassId++,
            i_isComplete : false,
            className : name,
            size : 1,
            i_reallyZeroSize : true,
            classScope : ClassScope.instance(name, parentScope, base && base.classScope),
            memberEntities : [],
            subobjectEntities : [],
            baseClassSubobjectEntities : [],
            memberSubobjectEntities : [],
            constructors : [],
            copyConstructor : null,
            destructor : null,

            i_baseClass : base || null // TODO: change if we ever want multiple inheritance


        });

        if (base){
            classType.addBaseClass(base);
        }


        members && members.forEach(classType.addMember.bind(classType));

        // var fakeDecl = FakeDeclaration.instance("numDucklings", Int.instance());
        // classType.addMember(MemberSubobjectEntity.instance(fakeDecl, classType));

        return classType;
    },

    addBaseClass : function(base) {
        this.baseClassSubobjectEntities.push(BaseClassSubobjectEntity.instance(base, this, "public"));
        this.subobjectEntities.push();
        this.size += base.size;
    },

    getBaseClass : function() {
        if (this.baseClassSubobjectEntities.length > 0) {
            return this.baseClassSubobjectEntities[0].type;
        }
        else {
            return null;
        }
    },

    memberLookup : function(memberName, options) {
        return this.classScope.memberLookup(memberName, options);
    },

    requiredMemberLookup : function(memberName, options) {
        return this.classScope.requiredMemberLookup(memberName, options);
    },

    hasMember : function(memberName, options) {
        return !!this.memberLookup(memberName, options);
    },

    addMember : function(mem){
        assert(this._isClass);
        this.classScope.addDeclaredEntity(mem);
        this.memberEntities.push(mem);
        if(mem.type.isObjectType){
            if (this.i_reallyZeroSize){
                this.size = 0;
                delete this.i_reallyZeroSize;
            }
            mem.memberIndex = this.memberSubobjectEntities.length;
            this.memberSubobjectEntities.push(mem);
            this.subobjectEntities.push(mem);
            this.size += mem.type.size;
        }
    },

    addConstructor : function(constructor){
        this.constructors.push(constructor);
    },

    addDestructor : function(destructor){
        this.destructor = destructor;
    },

    getDefaultConstructor : function(){
        return this.classScope.singleLookup(this.className+"\0", {
            own:true, noBase:true, exactMatch:true,
            paramTypes:[]});
    },

    getCopyConstructor : function(requireConst){
        return this.classScope.singleLookup(this.className+"\0", {
                own:true, noBase:true, exactMatch:true,
                paramTypes:[Reference.instance(this.instance(true))]}) ||
            !requireConst &&
            this.classScope.singleLookup(this.className+"\0", {
                own:true, noBase:true, exactMatch:true,
                paramTypes:[Reference.instance(this.instance(false))]});
    },

    getAssignmentOperator : function(requireConst, isThisConst){
        return this.classScope.singleLookup("operator=", {
                own:true, noBase:true, exactMatch:true,
                paramTypes:[this.instance()]}) ||
            this.classScope.singleLookup("operator=", {
                own:true, noBase:true, exactMatch:true,
                paramTypes:[Reference.instance(this.instance(true))]}) ||
            !requireConst &&
            this.classScope.singleLookup("operator=", {
                own:true, noBase:true, exactMatch:true,
                paramTypes:[Reference.instance(this.instance(false))]})

    },

    makeComplete : function() {
        this.i_isComplete = true;
    },

    isComplete : function(){
        return this.i_isComplete || this.i_isTemporarilyComplete;
    },
    setTemporarilyComplete : function(){
        this.i_isTemporarilyComplete = true;
    },
    unsetTemporarilyComplete : function(){
        delete this.i_isTemporarilyComplete;
    },


    // TODO: I think this is fragile dependent on order of compilation of translation units
    merge : function(class1, class2) {
        class1.i_classId = class2.i_classId = Math.min(class1.i_classId, class2.i_classId);
    },

    classString : function(){
        return this.className;
    },

    // Functions that may be called on either the class or the instance

    isDerivedFrom : function(potentialBase){
        var b = this.getBaseClass();
        while(b){
            if (similarType(potentialBase, b)){
                return true;
            }
            b = b.base;
        }
        return false;
    },


    // Below this are instance-only functions

    isInstanceOf : function(other) {
        return this.i_classId === other.i_classId;
    },

    sameType : function(other){
        //alert(other.isA(this._class));
        return this.similarType(other)
            && other.isConst === this.isConst
            && other.isVolatile === this.isVolatile;
    },

    similarType : function(other){
        //alert(other.isA(this._class));
        return other.isA(ClassType) && other.i_classId === this.i_classId;
    },
    typeString : function(excludeBase, varname, decorated){
        if (excludeBase) {
            return varname ? varname : "";
        }
        else{
            return this.getCVString() + (decorated ? Util.htmlDecoratedType(this.className) : this.className) + (varname ? " " + varname : "");
        }
    },
    englishString : function(plural){
        // no recursive calls to this.type.englishString() here
        // because this.type is just a string representing the type
        return this.getCVString() + (plural ? this.className+"s" : (isVowel(this.className.charAt(0)) ? "an " : "a ") + this.className);
    },
    valueToString : function(value){
        return JSON.stringify(value, null, 2);
    },
    bytesToValue : function(bytes){
        var val = {};
        var b = 0;
        for(var i = 0; i < this.memberSubobjectEntities.length; ++i) {
            var mem = this.memberSubobjectEntities[i];
            val[mem.name] = mem.type.bytesToValue(bytes.slice(b, b + mem.type.size));
            b += mem.type.size;
        }
        return val;
    },
    valueToBytes : function(value){
        var bytes = [];
        for(var i = 0; i < this.memberSubobjectEntities.length; ++i) {
            var mem = this.memberSubobjectEntities[i];
            bytes.pushAll(mem.type.valueToBytes(value[mem.name]));
        }
        return bytes;
    }

});
export {ClassType as Class};



// REQUIRES: returnType must be a type
//           argTypes must be an array of types
export class FunctionType extends Type {
    public static readonly _name = "FunctionType";

    private static readonly _defaultProps = addDefaultProperties(
        FunctionType.prototype,
        {
            isObjectType: false,
            precedence: 2,
            size: 0,
        }
    );
    
    init: function(returnType, paramTypes, isConst, isVolatile, isThisConst){
        this.initParent(isConst, isVolatile);

        if (isThisConst){
            this.isThisConst = true;
        }
        // Top-level const on return type is ignored for non-class types
        // (It's a value semantics thing.)
        // TODO not for poitners/refrences
        if(!(returnType instanceof ClassType || returnType instanceof Pointer || returnType instanceof Reference)){
            this.returnType = returnType.cvUnqualified();
        }
        else{
            this.returnType = returnType;
        }

        this.paramTypes = paramTypes.map(function(ptype){
            return ptype instanceof ClassType ? ptype : ptype.cvUnqualified();
        });
        // Top-level const on parameter types is ignored for non-class types



        this.isFunction = true;

        this.paramStrType = "(";
        for (var i = 0; i < paramTypes.length; ++i){
            this.paramStrType += (i == 0 ? "" : ",") + paramTypes[i];
        }
        this.paramStrType += ")";

        this.paramStrEnglish = "(";
        for (var i = 0; i < paramTypes.length; ++i){
            this.paramStrEnglish += (i == 0 ? "" : ", ") + paramTypes[i].englishString();
        }
        this.paramStrEnglish += ")";
        return this;
    },
    sameType : function(other){
        if (!other){
            return false;
        }
        if (!other.isA(FunctionType)){
            return false;
        }
        if (!this.sameReturnType(other)){
            return false;
        }
        if (!this.sameParamTypes(other)){
            return false;
        }
        return true;
    },
    similarType : function(other){
        return this.sameType(other);
    },
    sameParamTypes : function(other){
        if (other instanceof FunctionType){
            return this.sameParamTypes(other.paramTypes);
        }
        if (this.paramTypes.length !== other.length){
            return false;
        }
        for(var i = 0; i < this.paramTypes.length; ++i){
            if (!this.paramTypes[i].sameType(other[i])){
                return false;
            }
        }
        return true;
    },
    sameReturnType : function(other){
        return this.returnType.sameType(other.returnType);
    },
    sameSignature : function(other){
        return this.isThisConst === other.isThisConst && this.sameParamTypes(other);
    },
    typeString : function(excludeBase, varname, decorated){
		return this.returnType.typeString(excludeBase, varname + this.paramStrType, decorated);
	},

    englishString : function(plural){
		return (plural ? "functions that take " : "a function that takes ") + this.paramStrEnglish + " " +
			   (plural ? "and return " : "and returns ") + this.returnType.englishString();
	},
	valueToString : function(value){
		return ""+value;
	}
}
export {FunctionType as Function};