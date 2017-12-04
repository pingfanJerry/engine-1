pc.extend(pc, function () {
    /**
     * @name pc.ComponentSystemRegistry
     * @class Store, access and delete instances of the various ComponentSystems
     * @description Create a new ComponentSystemRegistry
     */
    var ComponentSystemRegistry = function () {
        this._list = [];
    };

    ComponentSystemRegistry.prototype = {
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#add
         * @description Add a new Component type
         * @param {Object} name The name of the Component
         * @param {Object} component The {pc.ComponentSystem} instance
         */
        add: function (name, system) {
            if(!this[name]) {
                this[name] = system;
                system.name = name;
                this._list.push(system);
            } else {
                throw new Error(pc.string.format("ComponentSystem name '{0}' already registered or not allowed", name));
            }
        },
        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#remove
         * @description Remove a Component type
         * @param {Object} name The name of the Component remove
         */
        remove: function(name) {
            if(!this[name]) {
                throw new Error(pc.string.format("No ComponentSystem named '{0}' registered", name));
            }

            // remove from list
            var i = this._list.indexOf(this[name]);
            this._list.splice(i, 1);

            // remove from map
            delete this[name];

        },

        /**
         * @private
         * @function
         * @name pc.ComponentSystemRegistry#list
         * @description Return the contents of the registry as an array. This is the order of system initialize and update.
         * @returns {pc.ComponentSystem[]} An array of component systems.
         */
        list: function () {
            return this._list;
        }
    };

    return {
        ComponentSystemRegistry: ComponentSystemRegistry
    };
}());
