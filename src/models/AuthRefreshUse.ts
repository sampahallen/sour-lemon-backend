import { DataTypes, Model, Sequelize } from 'sequelize'

export class AuthRefreshUse extends Model {
  declare tokenHash: string
  declare sessionId: string
  declare usedAt: Date
}

export const initAuthRefreshUse = (sequelize: Sequelize) => {
  AuthRefreshUse.init({
    tokenHash: { type: DataTypes.STRING(64), primaryKey: true },
    sessionId: { type: DataTypes.UUID, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    sequelize,
    tableName: 'auth_refresh_uses',
    modelName: 'AuthRefreshUse',
    underscored: true,
    timestamps: false,
  })
  return AuthRefreshUse
}
