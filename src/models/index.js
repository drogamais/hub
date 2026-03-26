const User = require('./User');
const App = require('./App');
const UserApp = require('./UserApp');
const RefreshToken = require('./RefreshToken');
const AuthorizationCode = require('./AuthorizationCode');

// Associações do SSO (Hub Central)
User.belongsToMany(App, { through: UserApp, foreignKey: 'id_usuario', otherKey: 'id_aplicacao', as: 'aplicacoes' });
App.belongsToMany(User, { through: UserApp, foreignKey: 'id_aplicacao', otherKey: 'id_usuario', as: 'usuarios' });

// Refresh tokens belong to a user and optionally to an app
RefreshToken.belongsTo(User, { foreignKey: 'id_usuario', as: 'user' });
RefreshToken.belongsTo(App, { foreignKey: 'id_aplicacao', as: 'app' });

AuthorizationCode.belongsTo(User, { foreignKey: 'id_usuario', as: 'user' });
AuthorizationCode.belongsTo(App, { foreignKey: 'id_aplicacao', as: 'app' });

module.exports = { User, App, UserApp, RefreshToken, AuthorizationCode };
