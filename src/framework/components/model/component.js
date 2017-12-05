pc.extend(pc, function () {
    /**
     * @component
     * @name pc.ModelComponent
     * @description Create a new ModelComponent
     * @class Enables an Entity to render a model or a primitive shape. This Component attaches additional model geometry in to the scene graph below the Entity.
     * @param {pc.ModelComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {String} type The type of the model, which can be one of the following values:
     * <ul>
     *     <li>asset: The component will render a model asset</li>
     *     <li>box: The component will render a box</li>
     *     <li>capsule: The component will render a capsule</li>
     *     <li>cone: The component will render a cone</li>
     *     <li>cylinder: The component will render a cylinder</li>
     *     <li>sphere: The component will render a sphere</li>
     * </ul>
     * @property {pc.Asset} asset The asset for the model (only applies to models of type 'asset') - can also be an asset id.
     * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
     * @property {Boolean} receiveShadows If true, shadows will be cast on this model
     * @property {Number} materialAsset The material {@link pc.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.Model} model The model that is added to the scene graph. It can be not set or loaded, so will return null.
     * @property {Object} mapping A dictionary that holds material overrides for each mesh instance. Only applies to model components of type 'asset'. The mapping contains pairs of mesh instance index - material asset id.
     * @property {Boolean} castShadowsLightmap If true, this model will cast shadows when rendering lightmaps
     * @property {Boolean} lightmapped If true, this model will be lightmapped after using lightmapper.bake()
     * @property {Number} lightmapSizeMultiplier Lightmap resolution multiplier
     * @property {Boolean} isStatic Mark model as non-movable (optimization)
     * @property {pc.MeshInstance[]} meshInstances An array of meshInstances contained in the component's model. If model is not set or loaded for component it will return null.
     * @property {Number} batchGroupId Assign model to a specific batch group (see {@link pc.BatchGroup}). Default value is -1 (no group).
     */

    var ModelComponent = function ModelComponent (system, entity)   {
        pc.Component.call(this, system, entity);

        this._type = 'asset';
        this._asset = null;
        this._castShadows = true;
        this._receiveShadows = true;
        this._materialAsset = null;
        this._mapping = null;
        this._castShadowsLightmap = true;
        this._lightmapped = false;
        this._lightmapSizeMultiplier = 1;
        this._isStatic = false;
        this._batchGroupId = -1;

        // non-serialized
        this._material = null;
        this._model = null;

        this._assetOld = 0;
        this._materialEvents = null;
        this._dirtyModelAsset = false;
        this._dirtyMaterialAsset = false;
        this._clonedModel = false;

        // #ifdef DEBUG
        this._batchGroup = null;
        // #endif

    };
    ModelComponent.prototype = Object.create(pc.Component.prototype);

    ModelComponent.prototype.setup = function (data) {
        data.material = this.system.defaultMaterial;

        if (data.batchGroupId === null || data.batchGroupId === undefined) {
            data.batchGroupId = -1;
        }

        // order is important.
        this._initializeProperties(['castShadows',
                                    'receiveShadows',
                                    'castShadowsLightmap',
                                    'lightmapped',
                                    'isStatic',
                                    'lightmapSizeMultiplier',
                                    'material',
                                    'materialAsset',
                                    'asset',
                                    'type',
                                    'mapping',
                                    'batchGroupId'], data);
    };

    ModelComponent.prototype.setVisible = function (visible) {
        console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
        this.enabled = visible;
    };

    ModelComponent.prototype._onAssetLoad = function(asset) {
        if (asset.resource) {
            this._onModelLoaded(asset.resource.clone());
            this._clonedModel = true;
        }
    };

    ModelComponent.prototype._onAssetUnload = function(asset) {
        if (!this.model) return;
        this.system.app.scene.removeModel(this.model);

        var device = this.system.app.graphicsDevice;

        this.model = null;
    };

    ModelComponent.prototype._onAssetChange = function(asset, attribute, newValue, oldValue) {
        // reset mapping
        if (attribute === 'data')
            this.mapping = this.data.mapping;
    };

    ModelComponent.prototype._onAssetRemove = function (asset) {
        if (this.asset === asset.id)
            this.asset = null;
    };

    ModelComponent.prototype._setModelAsset = function (id) {
        if (this._assetOld===id) return;

        // #ifdef DEBUG
        if (this._batchGroup) {
            console.warn("Trying to change a model that's part of a batch.");
        }
        // #endif

        var assets = this.system.app.assets;
        var asset = id !== null ? assets.get(id) : null;

        this._dirtyModelAsset = true;

        this._onModelAsset(asset || null);

        if (! asset && id !== null)
            assets.once("add:" + id, this._onModelAsset, this);
    };

    ModelComponent.prototype._onModelAsset = function(asset) {
        var assets = this.system.app.assets;

        // clear old assets bindings
        if (this._assetOld) {
            assets.off("add:" + this._assetOld, this._onModelAsset, this);

            var assetOld = assets.get(this._assetOld);
            if (assetOld) {
                assetOld.off('load', this._onAssetLoad, this);
                assetOld.off('unload', this._onAssetUnload, this);
                assetOld.off('change', this._onAssetChange, this);
                assetOld.off('remove', this._onAssetRemove, this);
            }
        }

        // remember new asset id
        this._assetOld = asset ? asset.id : 0;

        if (asset) {
            // subscribe to asset events
            asset.on('load', this._onAssetLoad, this);
            asset.on('unload', this._onAssetUnload, this);
            asset.on('change', this._onAssetChange, this);
            asset.on('remove', this._onAssetRemove, this);

            if (asset.resource) {
                this._dirtyModelAsset = false;
                this._onModelLoaded(asset.resource.clone());
                this._clonedModel = true;
            } else if (this.enabled && this.entity.enabled) {
                this._dirtyModelAsset = false;
                assets.load(asset);
            }
        } else {
            this._dirtyModelAsset = false;
        }
    };

    ModelComponent.prototype.remove = function() {
        this._onModelAsset(null);
    };

    ModelComponent.prototype._onModelLoaded = function (model) {
        if (this._type === 'asset') {
            this.model = model;
        }
    };

    ModelComponent.prototype._onMaterialAssetRemove = function(asset) {
        var assets = this.system.app.assets;
        var id = isNaN(asset) ? asset.id : asset;

        if (asset && isNaN(asset) && asset.resource === this.material)
            this.material = pc.ModelHandler.DEFAULT_MATERIAL;

        assets.off('add:' + id, this._onMaterialAssetAdd, this);
        assets.off('load:' + id, this._onMaterialAssetLoad, this);
        assets.off('unload:' + id, this._onMaterialAssetUnload, this);
        assets.off('remove:' + id, this._onMaterialAssetRemove, this);
    };

    ModelComponent.prototype._onMaterialAssetAdd = function(asset) {
        var assets = this.system.app.assets;

        if (asset.resource) {
            this.material = asset.resource;
            this._dirtyMaterialAsset = false;
        } else if (this.enabled && this.entity.enabled) {
            this._dirtyMaterialAsset = false;
            assets.load(asset);
        }
    };

    ModelComponent.prototype._onMaterialAssetLoad = function(asset) {
        var assets = this.system.app.assets;

        if (asset.resource) {
            this.material = asset.resource;
            this._dirtyMaterialAsset = false;
        } else if (this.enabled && this.entity.enabled) {
            this._dirtyMaterialAsset = false;
            assets.load(asset);
        }
    };

    ModelComponent.prototype._onMaterialAssetUnload = function (asset) {
        var assets = this.system.app.assets;
        var id = isNaN(asset) ? asset.id : asset;

        if (asset && isNaN(asset) && asset.resource === this.material) {
            this.material = pc.ModelHandler.DEFAULT_MATERIAL;
        }
    };

    ModelComponent.prototype._setMaterialEvent = function (index, event, id, handler) {
        var evt = event + ':' + id;
        this.system.app.assets.on(evt, handler, this);

        if (!this._materialEvents)
            this._materialEvents = [ ];

        if (!this._materialEvents[index])
            this._materialEvents[index] = { };

        this._materialEvents[index][evt] = {
            id: id,
            handler: handler
        };
    };

    ModelComponent.prototype._unsetMaterialEvents = function () {
        var assets = this.system.app.assets;
        var events = this._materialEvents;
        if (! events)
            return;

        for (var i = 0, len = events.length; i < len; i++) {
            if (! events[i]) continue;
            var evt = events[i];
            for (var key in evt) {
                assets.off(key, evt[key].handler, this);
            }
        }

        this._materialEvents = null;
    };

    ModelComponent.prototype._getAssetByIdOrPath = function (idOrPath) {
        var asset = null;
        var isPath = isNaN(parseInt(idOrPath, 10));

        // get asset by id or url
        if (!isPath) {
            asset = this.system.app.assets.get(idOrPath);
        } else if (this.asset) {
            var url = this._getMaterialAssetUrl(idOrPath);
            if (url)
                asset = this.system.app.assets.getByUrl(url);
        }

        return asset;
    };

    ModelComponent.prototype._getMaterialAssetUrl = function (path) {
        if (!this.asset) return null;

        var modelAsset = this.system.app.assets.get(this.asset);
        if (!modelAsset) return null;

        var fileUrl = modelAsset.getFileUrl();
        var dirUrl = pc.path.getDirectory(fileUrl);
        return pc.path.join(dirUrl, path);
    };

    ModelComponent.prototype._loadAndSetMeshInstanceMaterial = function (idOrPath, meshInstance, index) {
        var self = this;
        var assets = this.system.app.assets;

        // get asset by id or url
        var asset = this._getAssetByIdOrPath(idOrPath);
        if (! asset)
            return;

        var handleMaterial = function (asset) {
            if (asset.resource) {
                meshInstance.material = asset.resource;

                self._setMaterialEvent(index, 'remove', asset.id, function () {
                    meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                });
            } else {
                self._setMaterialEvent(index, 'load', asset.id, function (asset) {
                    meshInstance.material = asset.resource;

                    self._setMaterialEvent(index, 'remove', asset.id, function () {
                        meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                    });
                });

                if (self.enabled && self.entity.enabled)
                    assets.load(asset);
            }
        };

        if (asset) {
            handleMaterial(asset);
        } else {
            meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;

            var isPath = isNaN(parseInt(idOrPath, 10));
            self._setMaterialEvent(index, isPath ? 'add:url' : 'add', idOrPath, handleMaterial);
        }
    },

    ModelComponent.prototype.onSetReceiveShadows = function (name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.data;
            if (componentData.model) {
                var meshInstances = componentData.model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].receiveShadow = newValue;
                }
            }
        }
    },

    ModelComponent.prototype.onEnable = function () {
        pc.Component.prototype.onEnable.call(this);

        var asset;
        var model = this._model;
        var isAsset = this._type === 'asset';

        if (model) {
            var inScene = this.system.app.scene.containsModel(model);
            if (!inScene) {
                this.system.app.scene.addModel(model);
            }
        } else if (isAsset && this._dirtyModelAsset) {
            asset = this._asset;
            if (! asset)
                return;

            asset = this.system.app.assets.get(asset);
            if (asset)
                this._onModelAsset(asset);
        }

        // load materialAsset if necessary
        if (this._dirtyMaterialAsset) {
            var materialAsset = this._materialAsset;
            if (materialAsset) {
                materialAsset = this.system.app.assets.get(materialAsset);
                if (materialAsset && !materialAsset.resource) {
                    this._onMaterialAssetLoad(materialAsset);
                }
            }
        }

        // load mapping materials if necessary
        if (isAsset) {
            var mapping = this._mapping;
            if (mapping) {
                for (var index in mapping) {
                    if (mapping[index]) {
                        asset = this._getAssetByIdOrPath(mapping[index]);
                        if (asset && !asset.resource) {
                            this.system.app.assets.load(asset);
                        }
                    }
                }
            }
        }
    };

    ModelComponent.prototype.onDisable = function () {
        pc.Component.prototype.onDisable.call(this);

        var model = this._model;
        if (model) {
            var inScene = this.system.app.scene.containsModel(model);
            if (inScene) {
                this.system.app.scene.removeModel(model);
            }
        }
    };

    /**
    * @function
    * @name pc.ModelComponent#hide
    * @description Stop rendering model without removing it from the scene hierarchy.
    * This method sets the {@link pc.MeshInstance#visible} property of every MeshInstance in the model to false
    * Note, this does not remove the model or mesh instances from the scene hierarchy or draw call list.
    * So the model component still incurs some CPU overhead.
    * @example
    *   this.timer = 0;
    *   this.visible = true;
    *   // ...
    *   // blink model every 0.1 seconds
    *   this.timer += dt;
    *   if (this.timer > 0.1) {
    *       if (!this.visible) {
    *           this.entity.model.show();
    *           this.visible = true;
    *       } else {
    *           this.entity.model.hide();
    *           this.visible = false;
    *       }
    *       this.timer = 0;
    *   }
    */
    ModelComponent.prototype.hide = function () {
        var model = this._model;
        if (model) {
            var i, l;
            var instances = model.meshInstances;
            for (i = 0, l = instances.length; i < l; i++) {
                instances[i].visible = false;
            }
        }
    };

    /**
    * @function
    * @name pc.ModelComponent#show
    * @description Enable rendering of the model if hidden using {@link pc.ModelComponent#hide}.
    * This method sets all the {@link pc.MeshInstance#visible} property on all mesh instances to true.
    */
    ModelComponent.prototype.show = function () {
        var model = this._model;
        if (model) {
            var i, l;
            var instances = model.meshInstances;
            for (i = 0, l = instances.length; i < l; i++) {
                instances[i].visible = true;
            }
        }
    };

    Object.defineProperty(ModelComponent.prototype, 'type', {
        get: function () {
            return this._type;
        },
        set: function (value) {
            this._type = value;
            if (value) {
                var mesh = null;

                this._area = null;

                if (value === 'asset') {
                    if (this._asset !== null) {
                        this._setModelAsset(this._asset);
                    } else {
                        this.model = null;
                    }
                } else {
                    switch (value) {
                        case 'box':
                            mesh = this.system.box;
                            this._area = {x:2, y:2, z:2, uv:(2.0 / 3)};
                            break;
                        case 'capsule':
                            mesh = this.system.capsule;
                            this._area = {x:(Math.PI*2), y:Math.PI, z:(Math.PI*2), uv:(1.0/3 + ((1.0/3)/3)*2)};
                            break;
                        case 'sphere':
                            mesh = this.system.sphere;
                            this._area = {x:Math.PI, y:Math.PI, z:Math.PI, uv:1};
                            break;
                        case 'cone':
                            mesh = this.system.cone;
                            this._area = {x:2.54, y:2.54, z:2.54, uv:(1.0/3 + (1.0/3)/3)};
                            break;
                        case 'cylinder':
                            mesh = this.system.cylinder;
                            this._area = {x:Math.PI, y:(0.79*2), z:Math.PI, uv:(1.0/3 + ((1.0/3)/3)*2)};
                            break;
                        case 'plane':
                            mesh = this.system.plane;
                            this._area = {x:0, y:1, z:0, uv:1};
                            break;
                        default:
                            throw new Error("Invalid model type: " + value);
                    }

                    var node = new pc.GraphNode();

                    var model = new pc.Model();
                    model.graph = node;

                    model.meshInstances = [ new pc.MeshInstance(node, mesh, this._material) ];

                    // if (this.system._inTools)
                    //     model.generateWireframe();

                    this.model = model;
                    this.asset = null;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'asset', {
        get: function () {
            return this._asset;
        },
        set: function (value) {
            var id = null;
            if (this._type === 'asset') {
                if (value !== null) {
                    id = value;

                    if (value instanceof pc.Asset) {
                        this._asset = value.id;
                        id = value.id;
                    } else {
                        this._asset = value;
                    }
                } else {
                    this._asset = null;
                    this.model = null;
                }
            }

            if (id === null)
                this._asset = null;

            this._setModelAsset(id);
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'castShadows', {
        get: function () {
            return this._castShadows;
        },
        set: function (value) {
            var oldValue = this._castShadows;
            this._castShadows = value;

            var model = this._model;
            if (model) {
                var scene = this.system.app.scene;
                var inScene = scene.containsModel(model);
                if (inScene && oldValue && !value)
                    scene.removeShadowCaster(model);

                var meshInstances = model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++)
                    meshInstances[i].castShadow = value;

                if (inScene && !oldValue && value)
                    scene.addShadowCaster(model);
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'receiveShadows', {
        get: function () {
            return this._receiveShadows;
        },
        set: function (value) {
            this._receiveShadows = value;

            if (value !== undefined) {
                if (this._model) {
                    var meshInstances = this._model.meshInstances;
                    for (var i = 0; i < meshInstances.length; i++) {
                        meshInstances[i].receiveShadow = value;
                    }
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'lightmapped', {
        get: function () {
            return this._lightmapped;
        },
        set: function (value) {
            this._lightmapped = value;

            var i, m;
            if (this._model) {
                var rcv = this._model.meshInstances;
                if (value) {
                    for (i = 0; i < rcv.length; i++) {
                        m = rcv[i];
                        m.mask = pc.MASK_BAKED;
                    }
                } else {
                    for (i = 0; i < rcv.length; i++) {
                        m = rcv[i];
                        m.deleteParameter("texture_lightMap");
                        m.deleteParameter("texture_dirLightMap");
                        m._shaderDefs &= ~pc.SHADERDEF_LM;
                        m.mask = pc.MASK_DYNAMIC;
                    }
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'lightmapSizeMultiplier', {
        get: function () {
            return this._lightmapSizeMultiplier;
        },
        set: function (value) {
            this._lightmapSizeMultiplier = value;
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'isStatic', {
        get: function () {
            return this._isStatic;
        },
        set: function (value) {
            this._isStatic = value;

            var i, m;
            if (this._model) {
                var rcv = this._model.meshInstances;
                for (i = 0; i < rcv.length; i++) {
                    m = rcv[i];
                    m.isStatic = value;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'model', {
        get: function () {
            return this._model;
        },
        set: function (newValue) {
            var oldValue = this._model;
            this._model = newValue;

            if (oldValue) {
                this.system.app.scene.removeModel(oldValue);
                this.entity.removeChild(oldValue.getGraph());
                delete oldValue._entity;

                if (this._clonedModel) {
                    oldValue.destroy();
                    this._clonedModel = false;
                }
            }

            if (newValue) {
                var meshInstances = newValue.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = this._castShadows;
                    meshInstances[i].receiveShadow = this._receiveShadows;
                }

                // TODO: test these...
                this.lightmapped = this._lightmapped; // update meshInstances
                this.isStatic = this._isStatic;

                this.entity.addChild(newValue.graph);

                if (this.enabled && this.entity.enabled) {
                    this.system.app.scene.addModel(newValue);
                }

                // Store the entity that owns this model
                newValue._entity = this.entity;

                // Update any animation component
                if (this.entity.animation) {
                    this.entity.animation.setModel(newValue);
                }

                // trigger event handler to load mapping
                // for new model
                if (this._type === 'asset') {
                    this.mapping = this._mapping; // TODO: test this could error
                } else {
                    this._unsetMaterialEvents();
                }
            } else {
                this._unsetMaterialEvents();
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'material', {
        get: function () {
            return this._material;
        },
        set: function (newValue) {
            var oldValue = this._material;
            this._material = newValue;
            if (newValue !== oldValue) {
                if (this._model && this._type !== 'asset') {
                    var meshInstances = this._model.meshInstances;
                    for (var i = 0; i < meshInstances.length; i++) {
                        meshInstances[i].material = newValue;
                    }
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'materialAsset', {
        get: function () {
            return this.system.app.assets.get(this._materialAsset);
        },
        set: function (value) {
            this._materialAsset = value;

            this._dirtyMaterialAsset = true;

            // if the type of the value is not a number assume it is an pc.Asset
            var id = typeof value === 'number' || !value ? value : value.id;

            // var material;
            var assets = this.system.app.assets;
            var self = this;

            // unsubscribe
            if (this._materialAsset !== id) {
                if (this._materialAsset)
                    this._onMaterialAssetRemove(this._materialAsset);

                if (id) {
                    assets.on('load:' + id, this._onMaterialAssetLoad, this);
                    assets.on('unload:' + id, this._onMaterialAssetUnload, this);
                    assets.on('remove:' + id, this._onMaterialAssetRemove, this);
                }
            }

            // try to load the material asset
            if (id !== undefined && id !== null) {
                var asset = assets.get(id);
                if (asset)
                    this._onMaterialAssetLoad(asset);

                // subscribe for adds
                assets.once('add:' + id, this._onMaterialAssetAdd, this);
            } else if (id === null) {
                self.material = pc.ModelHandler.DEFAULT_MATERIAL;
                self._dirtyMaterialAsset = false;
            }

            // var valueOld = this._materialAsset;
            // this.data.materialAsset = id;
            // this.fire('set', 'materialAsset', valueOld, id);
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'mapping', {
        get: function () {
            return this._mapping;
        },
        set: function (newValue) {
            this._mapping = newValue;

            if (this._type !== 'asset' || !this._model)
                return;

            // unsubscribe from old events
            this._unsetMaterialEvents();

            if (!newValue)
                newValue = {};

            var meshInstances = this._model.meshInstances;
            var modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
            var assetMapping = modelAsset ? modelAsset.data.mapping : null;

            for (var i = 0, len = meshInstances.length; i < len; i++) {
                if (newValue[i] !== undefined) {
                    if (newValue[i]) {
                        this._loadAndSetMeshInstanceMaterial(newValue[i], meshInstances[i], i);
                    } else {
                        meshInstances[i].material = pc.ModelHandler.DEFAULT_MATERIAL;
                    }
                } else if (assetMapping) {
                    if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
                        var idOrPath = assetMapping[i].material || assetMapping[i].path;
                        this._loadAndSetMeshInstanceMaterial(idOrPath, meshInstances[i], i);
                    } else {
                        meshInstances[i].material = pc.ModelHandler.DEFAULT_MATERIAL;
                    }
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'batchGroupId', {
        get: function () {
            return this._batchGroupId;
        },
        set: function (newValue) {
            var oldValue = this._batchGroupId;
            this._batchGroupId = newValue;

            if (newValue < 0 && oldValue >= 0 && this.enabled && this.entity.enabled) {
                // re-add model to scene, in case it was removed by batching
                this.system.app.scene.addModel(this._model);
           }
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'meshInstances', {
        get: function () {
            if (! this.model)
                return null;

            return this.model.meshInstances;
        },
        set: function (value) {
            if (! this.model)
                return;

            this.model.meshInstances = value;
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
