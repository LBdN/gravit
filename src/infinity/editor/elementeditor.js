(function (_) {
    /**
     * The base for an element editor
     * @param {GXElement} element the element this editor works on
     * @class GXElementEditor
     * @extends GObject
     * @constructor
     */
    function GXElementEditor(element) {
        this._element = element;
    };
    GObject.inherit(GXElementEditor, GObject);

    GXElementEditor._Editors = {};

    GXElementEditor.exports = function (editorClass, nodeClass) {
        GXElementEditor._Editors[GObject.getTypeId(nodeClass)] = editorClass;
    };

    /**
     * Options for element editor
     */
    GXElementEditor.OPTIONS = {
        /**
         * The regular size of an annotation
         * @type Number
         */
        annotationSizeRegular: 6,

        /**
         * The small size of an annotation
         * @type Number
         */
        annotationSizeSmall: 4,

        /**
         * The size of the center cross
         * @type Number
         */
        centerCrossSize: 4
    };

    GXElementEditor.Flag = {
        /**
         * The editor is in selected status
         * @type Number
         * @version 1.0
         */
        Selected: 1 << 0,

        /**
         * The editor is in highlighted status
         * @type Number
         * @version 1.0
         */
        Highlighted: 1 << 1,

        /**
         * The editor is in focused status
         * @type Number
         * @version 1.0
         */
        Focused: 1 << 2,

        /**
         * The editor is in detail status
         * @type Number
         * @version 1.0
         */
        Detail: 1 << 3,

        /**
         * The editor is in outline status
         * @type Number
         * @version 1.0
         */
        Outline: 1 << 4
    };

    /**
     * Type of an annotation
     * @enum
     */
    GXElementEditor.Annotation = {
        Rectangle: 0,
        Circle: 1,
        Diamond: 2
    };

    /**
     * Returns any opened/attached editor on a element if it has any
     * @param {GXElement} element the element to get an open editor for
     * @returns {GXElementEditor} the editor opened on the element or null for none
     * @version 1.0
     */
    GXElementEditor.getEditor = function (element) {
        return element.__editor__ ? element.__editor__ : null;
    };

    /**
     * Create and returns a new editor instance for a given element
     * @param {GXElement} element the element to create an editor for
     * @return {GXElementEditor} a newly created element editor or null for none
     * @version 1.0
     */
    GXElementEditor.createEditor = function (element) {
        var editorClass = GXElementEditor._Editors[GObject.getTypeId(element)];
        if (editorClass) {
            return new editorClass(element);
        }
        return null;
    };

    /**
     * Opens and attaches an editor to a given element. Note that this will
     * also iterate up all parents and create their editors as well. Note
     * that only registered editors are opened. If the element already has
     * an editor, this call will be a NO-OP
     * @param {GXElement} element the element to open an editor on
     * @returns {GXElementEditor} the opened editor instance or null for none
     * @version 1.0
     */
    GXElementEditor.openEditor = function (element) {
        if (!element.isAttached()) {
            throw new Error("Node is not attached to create an editor for.");
        }
        if (GXElementEditor.getEditor(element) != null) {
            // editor already attached
            return GXElementEditor.getEditor(element);
        }
        var editor = GXElementEditor.createEditor(element);
        if (!editor) {
            return null;
        }

        // If we have a parent then create the parent's editor as well
        // and attach our new editor to it. Note that we'll iterate our
        // hierarchy up until we've found a valid editor parent. This
        // might overjump nodes in tree that do not have an editor.
        for (var parentNode = element.getParent(); parentNode !== null; parentNode = parentNode.getParent()) {
            var parentEditor = GXElementEditor.getEditor(parentNode);
            if (!parentEditor) {
                parentEditor = GXElementEditor.openEditor(parentNode);
            }
            if (parentEditor) {
                // Figure the right insertion point using element comparison
                var referenceEditor = null;
                for (var nextNode = element.getNext(); nextNode != null; nextNode = nextNode.getNext()) {
                    var nextEditor = GXElementEditor.getEditor(nextNode);
                    if (nextEditor) {
                        referenceEditor = nextEditor;
                        break;
                    }
                }

                parentEditor.insertEditor(editor, referenceEditor);

                // Done here, found a parent editor
                break;
            }
        }

        // Attach editor to element now and return it
        editor._attach();
        element.__editor__ = editor;

        return editor;
    };

    /**
     * Close an editor on a given element if it has any. Note that
     * this will also correctly remove the editor instance from
     * any parent editors the element may have as well as it will
     * close all sub editors of the element. Note that only registered
     * editors will be closed, others will be kept intact and require
     * a manual close / removal.
     * @param {GXElement} element the element to close the editor on
     * @version 1.0
     */
    GXElementEditor.closeEditor = function (element) {
        var elementEditor = GXElementEditor.getEditor(element);
        if (elementEditor) {
            // Return if editor is not registered
            var editorClass = GXElementEditor._Editors[GObject.getTypeId(element)];
            if (!editorClass) {
                return;
            }

            // Close all child editors if any, first
            var editors = elementEditor.getEditors();
            if (editors) {
                for (var i = 0; i < editors.length; ++i) {
                    GXElementEditor.closeEditor(editors[i].getElement());
                }
            }

            // Remove from any parent editor now
            if (elementEditor.getParentEditor()) {
                elementEditor.getParentEditor().removeEditor(elementEditor);
            }

            // Let editor know about detachment
            elementEditor._detach();

            // Finally detach and be done
            delete element.__editor__;
        }
    };

    // -----------------------------------------------------------------------------------------------------------------
    // GXElementEditor.PartInfo Class
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Part of an editor
     * @param {GXElementEditor} editor the owning editor of the part
     * @param {*} id id of the part, specific to editor
     * @param {*} [data] data of the part, specific to editor
     * @param {Boolean} isolated whether the part is isolated or not
     * @param {Boolean} selectable whether the part is selectable or not
     * @constructor
     * @class GXElementEditor.PartInfo
     */
    GXElementEditor.PartInfo = function (editor, id, data, isolated, selectable) {
        this.editor = editor;
        this.id = id;
        this.data = data;
        this.isolated = isolated;
        this.selectable = selectable;
    };

    /**
     * The id of the part, specific to editor
     * @type {*}
     */
    GXElementEditor.PartInfo.prototype.id = null;

    /**
     * The data of the part, specific to editor
     * @type {*}
     */
    GXElementEditor.PartInfo.prototype.data = null;

    /**
     * The owning editor of the part
     * @type {GXElementEditor}
     */
    GXElementEditor.PartInfo.prototype.editor = null;

    /**
     * Whether the part is isolated or not
     * @type {Boolean}
     */
    GXElementEditor.PartInfo.prototype.isolated = null;

    /**
     * Whether the part is selectable or not
     * @type {Boolean}
     */
    GXElementEditor.PartInfo.prototype.selectable = null;

    // -----------------------------------------------------------------------------------------------------------------
    // GXElementEditor Class
    // -----------------------------------------------------------------------------------------------------------------
    /**
     * @type {Number}
     * @private
     */
    GXElementEditor.prototype._flags = 0;

    /**
     * @type {GXElement}
     * @private
     */
    GXElementEditor.prototype._element = null;

    /**
     * @type {GXElement}
     * @private
     */
    GXElementEditor.prototype._elementPreview = null;

    /**
     * @type {GTransform}
     * @private
     */
    GXElementEditor.prototype._transform = null;

    /**
     * @type {GXElementEditor}
     * @private
     */
    GXElementEditor.prototype._parentEditor = null;

    /**
     * @type {Array<GXElementEditor>}
     * @private
     */
    GXElementEditor.prototype._editors = null;

    /**
     * @type {Array<*>}
     * @private
     */
    GXElementEditor.prototype._partSelection = null;

    /**
     * Checks whether this node editor has a certain flag setup
     * @param {Number} flag
     * @returns {Boolean}
     * @see GXElementEditor.Flag
     * @version 1.0
     */
    GXElementEditor.prototype.hasFlag = function (flag) {
        return (this._flags & flag) != 0;
    };

    /**
     * Set a flag on this node editor
     * @param {Number} flag the flag to set
     * @see GXElementEditor.Flag
     * @version 1.0
     */
    GXElementEditor.prototype.setFlag = function (flag) {
        if ((this._flags & flag) == 0) {
            this.requestInvalidation();
            this._flags = this._flags | flag;
            this.requestInvalidation();
        }
    };

    /**
     * Remove a flag from this node editor
     * @param {Number} flag the flag to remove
     * @see GXElementEditor.Flag
     * @version 1.0
     */
    GXElementEditor.prototype.removeFlag = function (flag) {
        if ((this._flags & flag) != 0) {
            this.requestInvalidation();
            this._flags = this._flags & ~flag;
            this.requestInvalidation();
        }
    };

    /**
     * Return the underlying element this editor is working on
     * @returns {GXElement}
     */
    GXElementEditor.prototype.getElement = function () {
        return this._element;
    };

    /**
     * Return the underlying element this editor is painting
     * @returns {GXElement}
     */
    GXElementEditor.prototype.getPaintElement = function () {
        return this._elementPreview ? this._elementPreview : this._element;
    };

    /**
     * Return the parent editor for this editor if any
     * @returns {GXElementEditor}
     * @version 1.0
     */
    GXElementEditor.prototype.getParentEditor = function () {
        return this._parentEditor;
    };

    /**
     * Return the sub editors if any
     * @returns {Array<GXElementEditor>} the sub editors array or null for none
     * @version 1.0
     */
    GXElementEditor.prototype.getEditors = function () {
        return this._editors;
    };

    /**
     * Called to append a sub editor to this one
     * @param {GXElementEditor} editor the editor to append
     * @version 1.0
     */
    GXElementEditor.prototype.appendEditor = function (editor) {
        this.insertEditor(editor, null);
    };

    /**
     * Called to insert a sub editor to this one
     * @param {GXElementEditor} editor the editor to insert
     * @param {GXElementEditor} referenceEditor the editor to insert before or
     * null to append at the end
     * @version 1.0
     */
    GXElementEditor.prototype.insertEditor = function (editor, referenceEditor) {
        var index = this._editors ? this._editors.length : 0;
        if (referenceEditor) {
            index = this._editors.indexOf(referenceEditor);
            if (index < 0) {
                throw new Error("Unknown reference editor.");
            }
        }

        if (editor._parentEditor != null) {
            throw new Error("Editor already appended.");
        }

        if (!this._editors) {
            this._editors = [];
        }

        if (index >= this._editors.length) {
            this._editors.push(editor);
        } else {
            this._editors.splice(index, 0, editor);
        }

        editor._parentEditor = this;
    };

    /**
     * Called to remove a sub editor from this one
     * @param {GXElementEditor} editor the editor to remove
     * @version 1.0
     */
    GXElementEditor.prototype.removeEditor = function (editor) {
        var index = this._editors.indexOf(editor);
        if (index < 0) {
            throw new Error("Unknown editor.");
        }

        this._editors.splice(index, 1);
        editor._parentEditor = null;
    };

    /**
     * Accept a visitor
     * @param {Function} visitor a visitor function called for each visit retrieving the current
     * node editor as first parameter. The function may return a boolean value indicating whether to
     * return visiting (true) or whether to cancel visiting (false). Not returning anything or
     * returning anything else than a Boolean will be ignored.
     * This defaults to false.
     * @return {Boolean} result of visiting (false = canceled, true = went through)
     * @version 1.0
     */
    GXElementEditor.prototype.accept = function (visitor) {
        if (visitor.call(null, this) === false) {
            return false;
        }

        if (this._editors) {
            for (var i = 0; i < this._editors.length; ++i) {
                if (this._editors[i].accept(visitor) === false) {
                    return false;
                }
            }
        }

        return true;
    };

    /**
     * Returns if a given part-id of this editor is selected or not
     * @param {*} partId
     * @return {Boolean}
     */
    GXElementEditor.prototype.isPartSelected = function (partId) {
        return this._indexOfPartId(this._partSelection, partId) >= 0;
    };

    /**
     * Get all selected parts
     * @returns {Array<*>}
     */
    GXElementEditor.prototype.getPartSelection = function () {
        return this._partSelection;
    };

    /**
     * Update the selected parts
     * @param {Boolean} toggle whether to toggle selection (true) or overwrite it (false)
     * @param {Array<*>} selection the new part selection to be assigned
     */
    GXElementEditor.prototype.updatePartSelection = function (toggle, selection) {
        if (this.hasFlag(GXElementEditor.Flag.Selected)) {
            var newSelection = null;

            if (!toggle || !this._partSelection) {
                newSelection = selection && selection.length > 0 ? selection.slice() : null;
            } else {
                if (selection) {
                    newSelection = [];

                    // Add all non-duplicates of previous selection
                    for (var i = 0; i < this._partSelection.length; ++i) {
                        if (this._indexOfPartId(selection, this._partSelection[i]) < 0) {
                            newSelection.push(this._partSelection[i]);
                        }
                    }

                    // Add all new ones
                    for (var i = 0; i < selection.length; ++i) {
                        if (this._indexOfPartId(this._partSelection, selection[i]) < 0) {
                            newSelection.push(selection[i]);
                        }
                    }

                    if (newSelection.length === 0) {
                        newSelection = null;
                    }
                }
            }

            if (!gUtil.equals(newSelection, this._partSelection, false)) {
                this._updatePartSelection(newSelection);
            }
        }
    };

    /**
     * Called whenever information about a part at a given location shall be returned
     * @param {GPoint} location the location to get a part for in view coordinates
     * @param {GTransform} transform the current transformation of the view
     * @param {Function} [acceptor] optional callback function getting called
     * for a part and receiving the current editor as it's only parameter.
     * The function should return true to accept the editor or false for not.
     * @returns {GXElementEditor.PartInfo} null if no part is available or a valid part info
     */
    GXElementEditor.prototype.getPartInfoAt = function (location, transform, acceptor) {
        // Iterate sub editors, first
        if (this._editors && this._editors.length) {
            for (var i = this._editors.length - 1; i >= 0; --i) {
                var result = this._editors[i].getPartInfoAt(location, transform, acceptor);
                if (result) {
                    return result;
                }
            }
        }

        if (acceptor && acceptor.call(null, this) !== true) {
            return null;
        }

        // Try to hit test our editor now
        var bbox = this.getBBox(transform);
        if (bbox && !bbox.isEmpty()) {
            if (bbox.containsPoint(location)) {
                var result = this._getPartInfoAt(location, transform);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    };

    /**
     * Called whenever this editor should paint itself
     * @param {GTransform} transform the transformation of the scene
     * @param {GXPaintContext} context
     */
    GXElementEditor.prototype.paint = function (transform, context) {
        // Paint children editors if any
        this._paintChildren(transform, context);
    };

    /**
     * Called whenever this editor should return it's bbox.
     * Note that this should never return a compound bbox like
     * unioning all children but only the bbox of this one
     * specific editor. If the editor doesn't have a real bbox
     * like a group, null should be returned.
     * @param {GTransform} transform the transformation of the scene
     * @return {GRect} the bbox in view coordinates
     */
    GXElementEditor.prototype.getBBox = function (transform) {
        if (this.hasFlag(GXElementEditor.Flag.Selected) || this.hasFlag(GXElementEditor.Flag.Highlighted)) {
            var targetTransform = transform;
            if (this._transform) {
                targetTransform = this._transform.multiplied(transform);
            }
            return targetTransform.mapRect(this.getPaintElement().getGeometryBBox()).expanded(1, 1, 1, 1);
        } else {
            return null;
        }
    };

    /**
     * Called to request an invalidation of this editor.
     * This will actually request an invalidation which will then
     * return back to this editor and ask it for providing
     * the actual invalidation area
     * @param {*} [args] optional arguments which will be passed
     * to this editor's invalidate callback.
     * If no arguments are passed, the editor will by default
     * return the bounding box of itself if it has any
     * @see invalidate
     */
    GXElementEditor.prototype.requestInvalidation = function (args) {
        GXEditor.getEditor(this._element.getScene()).requestInvalidation(this, args);
    };

    /**
     * Callback after an invalidation request
     * @param {GTransform} transform the transformation of the scene
     * @param {*} args optional args passed to the initial requestInvalidation
     * call. Maybe null which indicates to return this editor's bbox if any
     * @return {GRect} the transformed area to be invalidated or null for none
     */
    GXElementEditor.prototype.invalidate = function (transform, args) {
        // Default handling for no arguments
        if (!args) {
            return this.getBBox(transform);
        }
        return null;
    };

    /**
     * Called whenever a part of this editor shell be moved
     * @param {*} partId the id of the editor part to be moved
     * @param {*} partData the data of the editor part to be moved
     * @param {Boolean} ratio whether to keep any ratios or not
     * @param {GPoint} position the new position in scene coordinates
     * the part should be moved to
     */
    GXElementEditor.prototype.movePart = function (partId, partData, position, ratio) {
        // NO-OP by default
    };
    /**
     * Called whenever a move of a part shell be reset
     * @param {*} partId the id of the editor part that was moved
     * @param {*} partData the data of the editor part that was moved
     */
    GXElementEditor.prototype.resetPartMove = function (partId, partData) {
        // NO-OP by default
    };

    /**
     * Called whenever a move of a part shell be applied
     * @param {*} partId the id of the editor part that was moved
     * @param {*} partData the data of the editor part that was moved
     */
    GXElementEditor.prototype.applyPartMove = function (partId, partData) {
        // NO-OP by default
    };

    /**
     * Called whenever this editor shell be transformed
     * @param {GTransform} transform the transformation to be used
     * @param {*} [partId] optional id of part that initiated the transform
     * @param {*} [partData] optional data of part that initialized the transform
     */
    GXElementEditor.prototype.transform = function (transform, partId, partData) {
        // By default we'll simply assign the transformation
        if (!GTransform.equals(this._transform, transform)) {
            if (!this.hasFlag(GXElementEditor.Flag.Outline)) {
                this.setFlag(GXElementEditor.Flag.Outline);
            } else {
                this.requestInvalidation();
            }

            this._transform = transform;
            this.requestInvalidation();
        }
    };

    /**
     * Called whenever the transformation of the editor shell be reset
     */
    GXElementEditor.prototype.resetTransform = function () {
        if (this._transform && !this._transform.isIdentity()) {
            this.requestInvalidation();
        }

        this._transform = null;

        // Remove outline
        this.removeFlag(GXElementEditor.Flag.Outline);
    };

    /**
     * Called whenever the transformation of the editor shell be applied.
     * Note that the caller might decide that the transformation shall be
     * applied to another element and not the one the editor is currently
     * working on. However, it is guaranteed that in this case, the element
     * to apply the transformation instead is an exact clone of the element
     * this editor is currently working on.
     * @param {GXElement} element the element to apply the transformation
     * to which might be different than the one this editor works on. This
     * will be never null.
     */
    GXElementEditor.prototype.applyTransform = function (element) {
        if (!this._transform.isIdentity()) {
            // By default we'll simply transfer the transformation to the element
            element.transform(this._transform);
        }
        this.resetTransform();
    };

    /**
     * Called when this editor is attached to the node
     */
    GXElementEditor.prototype._attach = function () {
        // NO-OP
    };

    /**
     * Called when this editor is detached from the node
     */
    GXElementEditor.prototype._detach = function () {
        // NO-OP
    };

    /**
     * Paint all sub editors if any
     * @param {GXPaintContext} context
     * @private
     */
    GXElementEditor.prototype._paintChildren = function (transform, context) {
        if (this._editors) {
            for (var i = 0; i < this._editors.length; ++i) {
                var editor = this._editors[i];
                if (editor instanceof GXElementEditor) {
                    editor.paint(transform, context);
                }
            }
        }
    };

    /**
     * Called whenever a part should be returned at a given location.
     * Note that the caller is responsible for testing the bbox of this
     * editor for faster lookup as well as the caller is responsible for
     * iterating any sub editors as well.
     * @param {GPoint} location the location to get a part for in view coordinates
     * @param {GTransform} transform the current transformation of the view
     * @returns {*} null if no part is available or an editor-specific part
     */
    GXElementEditor.prototype._getPartInfoAt = function (location, transform) {
        return null;
    };

    /**
     * Compare two part ids. If part ids of the editor are complex then
     * the editor descendant should override this with a custom comparison.
     * @param {*} a
     * @param {*} b
     * @returns {boolean}
     * @private
     */
    GXElementEditor.prototype._partIdAreEqual = function (a, b) {
        return a === b;
    };

    /**
     * Get index of part-id within an array using the _partIdAreEqual function
     * @param {Array<*>} array
     * @param {*} partId
     * @returns {Number}
     * @private
     */
    GXElementEditor.prototype._indexOfPartId = function (array, partId) {
        if (array && array.length > 0) {
            for (var i = 0; i < array.length; ++i) {
                if (this._partIdAreEqual(array[i], partId)) {
                    return i;
                }
            }
        }
        return -1;
    };

    /**
     * Called whenever the part selection should be udpated
     * @param {Array<*>} selection the new part selection
     * @private
     */
    GXElementEditor.prototype._updatePartSelection = function (selection) {
        this.requestInvalidation();
        this._partSelection = selection;
        this.requestInvalidation();
    };

    var _annotationTemplates = {};

    function _getAnnotationTemplate(annotation) {
        // Prepare vertex cache, first
        var annotationTemplate = _annotationTemplates[annotation];
        if (!annotationTemplate) {
            var vertices = new GXVertexContainer();
            var scaleFactor = 1;

            switch (annotation) {
                case GXElementEditor.Annotation.Rectangle:
                    vertices.addVertex(GXVertex.Command.Move, -1, -1);
                    vertices.addVertex(GXVertex.Command.Line, 1, -1);
                    vertices.addVertex(GXVertex.Command.Line, 1, 1);
                    vertices.addVertex(GXVertex.Command.Line, -1, 1);
                    vertices.addVertex(GXVertex.Command.Close);
                    break;

                case GXElementEditor.Annotation.Circle:
                    vertices.addVertex(GXVertex.Command.Move, -1, 0);
                    vertices.addVertex(GXVertex.Command.Curve, 0, -1);
                    vertices.addVertex(GXVertex.Command.Curve, -1, -1);
                    vertices.addVertex(GXVertex.Command.Curve, 1, 0);
                    vertices.addVertex(GXVertex.Command.Curve, 1, -1);
                    vertices.addVertex(GXVertex.Command.Curve, 0, 1);
                    vertices.addVertex(GXVertex.Command.Curve, 1, 1);
                    vertices.addVertex(GXVertex.Command.Curve, -1, 0);
                    vertices.addVertex(GXVertex.Command.Curve, -1, 1);
                    break;

                case GXElementEditor.Annotation.Diamond:
                    vertices.addVertex(GXVertex.Command.Move, -1, 0);
                    vertices.addVertex(GXVertex.Command.Line, 0, -1);
                    vertices.addVertex(GXVertex.Command.Line, 1, 0);
                    vertices.addVertex(GXVertex.Command.Line, 0, 1);
                    vertices.addVertex(GXVertex.Command.Close);
                    scaleFactor = Math.cos(Math.PI / 4);
                    break;
            }

            annotationTemplate = {
                vertices: vertices,
                scaleFactor: scaleFactor
            }
            _annotationTemplates[annotation] = annotationTemplate;
        }
        return annotationTemplate;
    };

    /**
     * Paint an annotation
     * @param {GXPaintContext} context the paint context to paint on
     * @param {GTransform} transform the current transformation in use
     * @param {GPoint} center the center point of the annotation
     * @param {GXElementEditor.Annotation} annotation the annotation to be painted
     * @param {Boolean} [selected] whether the annotation should be painted
     * selected or not. Defaults to false.
     * @param {Boolean} [small] if true, paints the annotation in small size,
     * otherwise in default size
     */
    GXElementEditor.prototype._paintAnnotation = function (context, transform, center, annotation, selected, small) {
        var annotationTemplate = _getAnnotationTemplate(annotation);

        // Now paint our annotation
        if (transform) {
            center = transform.mapPoint(center);
        }

        var size = small ? GXElementEditor.OPTIONS.annotationSizeSmall : GXElementEditor.OPTIONS.annotationSizeRegular;

        var fillColor = context.selectionOutlineColor;
        var strokeColor = gColor.build(255, 255, 255);
        if (selected) {
            fillColor = strokeColor;
            strokeColor = context.selectionOutlineColor;
        }

        var cx = Math.floor(center.getX()) + (selected ? 0.5 : 0);
        var cy = Math.floor(center.getY()) + (selected ? 0.5 : 0);
        var sx = size / 2 / annotationTemplate.scaleFactor;
        var sy = size / 2 / annotationTemplate.scaleFactor;
        var canvas = context.canvas;

        canvas.putVertices(new GXVertexTransformer(annotationTemplate.vertices, new GTransform(sx, 0, 0, sy, cx, cy)));
        canvas.fillVertices(fillColor);
        // TODO : Transform and fill with stroke first, then fill to avoid expensive stroke operations for annotations at all
        if (selected) {
            canvas.strokeVertices(strokeColor, 1);
        }
    };

    /**
     * Get bbox of an annotation
     * @param {GTransform} transform the current transformation in use
     * @param {GPoint} center the center point of the annotation
     * @param {Boolean} [small] whether to paint small annotation or not
     */
    GXElementEditor.prototype._getAnnotationBBox = function (transform, center, small) {
        if (transform) {
            center = transform.mapPoint(center);
        }

        var size = small ? GXElementEditor.OPTIONS.annotationSizeSmall : GXElementEditor.OPTIONS.annotationSizeRegular;
        var cx = Math.floor(center.getX()) + 0.5;
        var cy = Math.floor(center.getY()) + 0.5;

        return new GRect(cx - size / 2 - 1, cy - size / 2 - 1, size + 2, size + 2);
    };

    /**
     * @returns {Boolean}
     * @private
     */
    GXElementEditor.prototype._showAnnotations = function () {
        return this.hasFlag(GXElementEditor.Flag.Selected) && !this.hasFlag(GXElementEditor.Flag.Outline);
    };

    /** @override */
    GXElementEditor.prototype.toString = function () {
        return "[Object GXElementEditor]";
    };

    _.GXElementEditor = GXElementEditor;
})(this);