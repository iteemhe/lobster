import { TemporaryObjectEntity } from "./entities";
import { Mutable, assertFalse, assert } from "../util/util";
import { CompleteObjectType } from "./types";
import { TemporaryObject } from "./objects";
import { TranslationUnitContext } from "./contexts";
import { BasicCPPConstruct, SuccessfullyCompiled, RuntimeConstruct, StackType, CPPConstruct } from "./constructs";
import { ASTNode } from "../ast/ASTNode";
import { TemporaryDeallocator, CompiledTemporaryDeallocator, RuntimeTemporaryDeallocator } from "./TemporaryDeallocator";
import { FunctionCall } from "./FunctionCall";

export abstract class PotentialFullExpression<ContextType extends TranslationUnitContext = TranslationUnitContext, ASTType extends ASTNode = ASTNode> extends BasicCPPConstruct<ContextType, ASTType> {
    public readonly temporaryObjects: TemporaryObjectEntity[] = [];
    public readonly temporaryDeallocator?: TemporaryDeallocator;

    public override onAttach(parent: CPPConstruct) {

        super.onAttach(parent);

        // This may no longer be a full expression. If so, move temporary entities to
        // their new full expression.
        if (!this.isFullExpression()) {
            let fe = this.findFullExpression();
            this.temporaryObjects.forEach((tempEnt) => {
                fe.addTemporaryObject(tempEnt);
            });
            this.temporaryObjects.length = 0; // clear array
        }
        else {
            // If this was a full expression...
            // Now that we are attached, the assumption is no more temporary entities
            // will be added to this construct or its attached children. (There's an
            // assert in addTemporaryObject() to prevent this.) That means it is now
            // safe to compile and add the temporary deallocator construct as a child.
            (<TemporaryDeallocator>this.temporaryDeallocator) = new TemporaryDeallocator(this.context, this.temporaryObjects);
            this.attach(this.temporaryDeallocator!);
        }
    }

    public isFullExpression(): boolean {
        return !this.parent?.findFullExpression();
    }
    // TODO: this function can probably be cleaned up so that it doesn't require these ugly runtime checks
    /**
     * Returns the nearest full expression containing this expression (possibly itself).
     * @param inst
     */
    public findFullExpression(): PotentialFullExpression | FunctionCall {
        return this.parent?.findFullExpression() ?? this;
    }
    
    public mayManageTemporaryLifetimes() : this is PotentialFullExpression {
        return true;
    }

    public addTemporaryObject(tempObjEnt: TemporaryObjectEntity) {
        assert(!this.parent, "Temporary objects may not be added to a full expression after it has been attached.");
        this.temporaryObjects.push(tempObjEnt);
        tempObjEnt.setOwner(this);
    }

    public createTemporaryObject<T extends CompleteObjectType>(type: T, name: string): TemporaryObjectEntity<T> {
        let fe = this.findFullExpression();
        var tempObjEnt = new TemporaryObjectEntity(type, this, fe, name);
        fe.addTemporaryObject(tempObjEnt);
        return tempObjEnt;
    }
}

export interface CompiledPotentialFullExpression extends PotentialFullExpression, SuccessfullyCompiled {
    readonly temporaryDeallocator?: CompiledTemporaryDeallocator;
}

export abstract class RuntimePotentialFullExpression<C extends CompiledPotentialFullExpression = CompiledPotentialFullExpression> extends RuntimeConstruct<C> {
    public readonly temporaryDeallocator?: RuntimeTemporaryDeallocator;

    public readonly temporaryObjects: {
        [index: number]: TemporaryObject | undefined;
    } = {};

    public readonly containingFullExpression: RuntimePotentialFullExpression;

    public constructor(model: C, stackType: StackType, parent: RuntimeConstruct) {
        super(model, stackType, parent);
        if (this.model.temporaryDeallocator) {
            this.temporaryDeallocator = this.model.temporaryDeallocator.createRuntimeConstruct(this);
            this.setCleanupConstruct(this.temporaryDeallocator);
        }
        this.containingFullExpression = this.findFullExpression();
    }
    
    private findFullExpression(): RuntimePotentialFullExpression {
        let rt: RuntimeConstruct = this;
        while (!rt.model.isFullExpression() && rt.parent) {
            rt = rt.parent;
        }
        if (rt instanceof RuntimePotentialFullExpression) {
            return rt;
        }
        else {
            return assertFalse();
        }
    }
}



