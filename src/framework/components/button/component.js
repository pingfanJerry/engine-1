pc.extend(pc, function () {
    var VisualState = {
        DEFAULT: 'DEFAULT',
        HOVER: 'HOVER',
        PRESSED: 'PRESSED',
        INACTIVE: 'INACTIVE'
    };

    var STATES_TO_TINT_NAMES = {};
    STATES_TO_TINT_NAMES[VisualState.DEFAULT] = '_defaultTint';
    STATES_TO_TINT_NAMES[VisualState.HOVER] = 'hoverTint';
    STATES_TO_TINT_NAMES[VisualState.PRESSED] = 'pressedTint';
    STATES_TO_TINT_NAMES[VisualState.INACTIVE] = 'inactiveTint';

    var STATES_TO_SPRITE_ASSET_NAMES = {};
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.DEFAULT] = '_defaultSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.HOVER] = 'hoverSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.PRESSED] = 'pressedSpriteAsset';
    STATES_TO_SPRITE_ASSET_NAMES[VisualState.INACTIVE] = 'inactiveSpriteAsset';

    var STATES_TO_SPRITE_FRAME_NAMES = {};
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.DEFAULT] = '_defaultSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.HOVER] = 'hoverSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.PRESSED] = 'pressedSpriteFrame';
    STATES_TO_SPRITE_FRAME_NAMES[VisualState.INACTIVE] = 'inactiveSpriteFrame';

    /**
     * @component
     * @name pc.ButtonComponent
     * @description Create a new ButtonComponent
     * @classdesc A ButtonComponent enables a group of entities to behave like a button, with different visual states for hover and press interactions.
     * @param {pc.ButtonComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {Boolean} active If set to false, the button will be visible but will not respond to hover or touch interactions.
     * @property {pc.Entity} imageEntity A reference to the entity to be used as the button background. The entity must have an ImageElement component.'
     * @property {pc.Vec4} hitPadding Padding to be used in hit-test calculations. Can be used to expand the bounding box so that the button is easier to tap.
     * @property {pc.BUTTON_TRANSITION_MODE} transitionMode Controls how the button responds when the user hovers over it/presses it.
     * @property {pc.Color} hoverTint Color to be used on the button image when the user hovers over it.
     * @property {pc.Color} pressedTint Color to be used on the button image when the user presses it.
     * @property {pc.Color} inactiveTint Color to be used on the button image when the button is not interactive.
     * @property {Number} fadeDuration Duration to be used when fading between tints, in milliseconds.
     * @property {pc.Asset} hoverSpriteAsset Sprite to be used as the button image when the user hovers over it.
     * @property {Number} hoverSpriteFrame Frame to be used from the hover sprite.
     * @property {pc.Asset} pressedSpriteAsset Sprite to be used as the button image when the user presses it.
     * @property {Number} pressedSpriteFrame Frame to be used from the pressed sprite.
     * @property {pc.Asset} inactiveSpriteAsset Sprite to be used as the button image when the button is not interactive.
     * @property {Number} inactiveSpriteFrame Frame to be used from the inactive sprite.
     */
    var ButtonComponent = function ButtonComponent(system, entity) {
        this._visualState = VisualState.DEFAULT;
        this._isHovering = false;
        this._isPressed = false;

        this._defaultTint = new pc.Color(1, 1, 1, 1);
        this._defaultSpriteAsset = null;
        this._defaultSpriteFrame = 0;

        this._imageReference = new pc.EntityReference(this, 'imageEntity', {
            'element#gain': this._onImageElementGain,
            'element#lose': this._onImageElementLose,
            'element#set:color': this._onSetColor,
            'element#set:opacity': this._onSetOpacity,
            'element#set:spriteAsset': this._onSetSpriteAsset,
            'element#set:spriteFrame': this._onSetSpriteFrame,
            'element#mouseenter': this._onMouseEnter,
            'element#mouseleave': this._onMouseLeave,
            'element#mousedown': this._onMouseDown,
            'element#mouseup': this._onMouseUp,
            'element#touchstart': this._onTouchStart,
            'element#touchend': this._onTouchEnd,
            'element#touchleave': this._onTouchLeave,
            'element#touchcancel': this._onTouchCancel,
            'element#click': this._onClick
        });

        this._toggleLifecycleListeners('on', system);
    };
    ButtonComponent = pc.inherits(ButtonComponent, pc.Component);

    pc.extend(ButtonComponent.prototype, {
        _toggleLifecycleListeners: function (onOrOff, system) {
            this[onOrOff]('set_active', this._onSetActive, this);
            this[onOrOff]('set_transitionMode', this._onSetTransitionMode, this);
            this[onOrOff]('set_hoverTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveTint', this._onSetTransitionValue, this);
            this[onOrOff]('set_hoverSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_hoverSpriteFrame', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_pressedSpriteFrame', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveSpriteAsset', this._onSetTransitionValue, this);
            this[onOrOff]('set_inactiveSpriteFrame', this._onSetTransitionValue, this);

            pc.ComponentSystem[onOrOff]('update', this._onUpdate, this);
        },

        _onSetActive: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._updateVisualState();
            }
        },

        _onSetTransitionMode: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._cancelTween();
                this._resetToDefaultVisualState(oldValue);
                this._forceReapplyVisualState();
            }
        },

        _onSetTransitionValue: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                this._forceReapplyVisualState();
            }
        },

        _onImageElementLose: function () {
            this._cancelTween();
            this._resetToDefaultVisualState(this.transitionMode);
        },

        _onImageElementGain: function () {
            this._storeDefaultVisualState();
            this._forceReapplyVisualState();
        },

        _storeDefaultVisualState: function () {
            if (this._imageReference.hasComponent('element')) {
                this._storeDefaultColor(this._imageReference.entity.element.color);
                this._storeDefaultOpacity(this._imageReference.entity.element.opacity);
                this._storeDefaultSpriteAsset(this._imageReference.entity.element.spriteAsset);
                this._storeDefaultSpriteFrame(this._imageReference.entity.element.spriteFrame);
            }
        },

        _storeDefaultColor: function (color) {
            this._defaultTint.r = color.r;
            this._defaultTint.g = color.g;
            this._defaultTint.b = color.b;
        },

        _storeDefaultOpacity: function (opacity) {
            this._defaultTint.a = opacity;
        },

        _storeDefaultSpriteAsset: function (spriteAsset) {
            this._defaultSpriteAsset = spriteAsset;
        },

        _storeDefaultSpriteFrame: function (spriteFrame) {
            this._defaultSpriteFrame = spriteFrame;
        },

        _onSetColor: function (color) {
            if (!this._isApplyingTint) {
                this._storeDefaultColor(color);
                this._forceReapplyVisualState();
            }
        },

        _onSetOpacity: function (opacity) {
            if (!this._isApplyingTint) {
                this._storeDefaultOpacity(opacity);
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteAsset: function (spriteAsset) {
            if (!this._isApplyingSprite) {
                this._storeDefaultSpriteAsset(spriteAsset);
                this._forceReapplyVisualState();
            }
        },

        _onSetSpriteFrame: function (spriteFrame) {
            if (!this._isApplyingSprite) {
                this._storeDefaultSpriteFrame(spriteFrame);
                this._forceReapplyVisualState();
            }
        },

        _onMouseEnter: function (event) {
            this._isHovering = true;

            this._updateVisualState();
            this.fire('mouseenter', event);
        },

        _onMouseLeave: function (event) {
            this._isHovering = false;
            this._isPressed = false;

            this._updateVisualState();
            this.fire('mouseleave', event);
        },

        _onMouseDown: function (event) {
            this._isPressed = true;

            this._updateVisualState();
            this.fire('mousedown', event);
        },

        _onMouseUp: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('mouseup', event);
        },

        _onTouchStart: function (event) {
            this._isPressed = true;

            this._updateVisualState();
            this.fire('touchstart', event);
        },

        _onTouchEnd: function(event) {
            // The default behaviour of the browser is to simulate a series of
            // `mouseenter/down/up` events immediately after the `touchend` event,
            // in order to ensure that websites that don't explicitly listen for
            // touch events will still work on mobile (see https://www.html5rocks.com/en/mobile/touchandmouse/
            // for reference). This leads to an issue whereby buttons will enter
            // the `hover` state on mobile browsers after the `touchend` event is
            // received, instead of going back to the `default` state. Calling
            // preventDefault() here fixes the issue.
            event.event.preventDefault();

            this._isPressed = false;

            this._updateVisualState();
            this.fire('touchend', event);
        },

        _onTouchLeave: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('touchleave', event);
        },

        _onTouchCancel: function (event) {
            this._isPressed = false;

            this._updateVisualState();
            this.fire('touchcancel', event);
        },

        _onClick: function (event) {
            this.fire('click', event);
        },

        _updateVisualState: function (force) {
            var oldVisualState = this._visualState;
            var newVisualState = this._determineVisualState();

            if ((oldVisualState !== newVisualState || force) && this.enabled) {
                this._visualState = newVisualState;

                switch (this.transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        var tintName = STATES_TO_TINT_NAMES[this._visualState];
                        var tintColor = this[tintName];
                        this._applyTint(tintColor);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        var spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
                        var spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
                        var spriteAsset = this[spriteAssetName];
                        var spriteFrame = this[spriteFrameName];
                        this._applySprite(spriteAsset, spriteFrame);
                        break;
                }
            }
        },

        /*
         * Called when a property changes that mean the visual state must be reapplied,
         * even if the state enum has not changed. Examples of this are when the tint
         * value for one of the states is changed via the editor.
         */
        _forceReapplyVisualState: function () {
            this._updateVisualState(true);
        },

        /*
         * Called before the image entity changes, in order to restore the previous
         * image back to its original tint. Note that this happens immediately, i.e.
         * without any animation.
         */
        _resetToDefaultVisualState: function (transitionMode) {
            if (this._imageReference.hasComponent('element')) {
                switch (transitionMode) {
                    case pc.BUTTON_TRANSITION_MODE_TINT:
                        this._cancelTween();
                        this._applyTintImmediately(this._defaultTint);
                        break;

                    case pc.BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
                        this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
                        break;
                }
            }
        },

        _determineVisualState: function () {
            if (!this.active) {
                return VisualState.INACTIVE;
            } else if (this._isPressed) {
                return VisualState.PRESSED;
            } else if (this._isHovering) {
                return VisualState.HOVER;
            }

            return VisualState.DEFAULT;
        },

        _applySprite: function (spriteAsset, spriteFrame) {
            spriteFrame = spriteFrame || 0;

            if (this._imageReference.hasComponent('element')) {
                this._isApplyingSprite = true;
                this._imageReference.entity.element.spriteAsset = spriteAsset;
                this._imageReference.entity.element.spriteFrame = spriteFrame;
                this._isApplyingSprite = false;
            }
        },

        _applyTint: function (tintColor) {
            this._cancelTween();

            if (this.fadeDuration === 0) {
                this._applyTintImmediately(tintColor);
            } else {
                this._applyTintWithTween(tintColor);
            }
        },

        _applyTintImmediately: function (tintColor) {
            if (this._imageReference.hasComponent('element') && tintColor) {
                this._isApplyingTint = true;
                this._imageReference.entity.element.color = toColor3(tintColor);
                this._imageReference.entity.element.opacity = tintColor.a;
                this._isApplyingTint = false;
            }
        },

        _applyTintWithTween: function (tintColor) {
            if (this._imageReference.hasComponent('element') && tintColor) {
                var color = this._imageReference.entity.element.color;
                var opacity = this._imageReference.entity.element.opacity;

                this._tweenInfo = {
                    startTime: pc.now(),
                    from: new pc.Color(color.r, color.g, color.b, opacity),
                    to: tintColor.clone(),
                    lerpVec: new pc.Vec4()
                };
            }
        },

        _updateTintTween: function () {
            var elapsedTime = pc.now() - this._tweenInfo.startTime;
            var elapsedProportion = this.fadeDuration === 0 ? 1 : (elapsedTime / this.fadeDuration);
            elapsedProportion = pc.math.clamp(elapsedProportion, 0, 1);

            if (Math.abs(elapsedProportion - 1) > 1e-5) {
                this._tweenInfo.lerpVec.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
                this._applyTintImmediately(new pc.Color(this._tweenInfo.lerpVec.data));
            } else {
                this._applyTintImmediately(this._tweenInfo.to);
                this._cancelTween();
            }
        },

        _cancelTween: function () {
            delete this._tweenInfo;
        },

        _onUpdate: function () {
            if (this._tweenInfo) {
                this._updateTintTween();
            }
        },

        onEnable: function () {
            this._forceReapplyVisualState();
        },

        onDisable: function () {
            this._resetToDefaultVisualState(this.transitionMode);
        },

        onRemove: function () {
            this._toggleLifecycleListeners('off', this.system);
            this.onDisable();
        }
    });

    function toColor3(color4) {
        return new pc.Color(color4.r, color4.g, color4.b);
    }

    return {
        ButtonComponent: ButtonComponent
    };
}());
