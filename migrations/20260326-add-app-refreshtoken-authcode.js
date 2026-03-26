"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Add OAuth columns to application table (dim_aplicacao)
    try {
      await queryInterface.addColumn('dim_aplicacao', 'client_id', {
        type: Sequelize.STRING(128),
        allowNull: true,
        unique: true,
      });
    } catch (e) {
      // ignore if already exists
    }

    try {
      await queryInterface.addColumn('dim_aplicacao', 'client_secret', {
        type: Sequelize.STRING(256),
        allowNull: true,
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('dim_aplicacao', 'redirect_uris', {
        // store as TEXT (JSON array or newline-separated list)
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('dim_aplicacao', 'allowed_origins', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } catch (e) {}

    // 2) Create refresh_tokens table
    await queryInterface.createTable('refresh_tokens', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      token: {
        type: Sequelize.STRING(512),
        allowNull: false,
        unique: true,
      },
      id_usuario: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      id_aplicacao: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // 3) Create authorization_codes table
    await queryInterface.createTable('authorization_codes', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(256),
        allowNull: false,
        unique: true,
      },
      id_usuario: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      id_aplicacao: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      redirect_uri: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      used: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // 4) Add foreign key constraints if relevant tables exist
    // Wrap in try/catch to avoid failing on varying schemas
    try {
      await queryInterface.addConstraint('refresh_tokens', {
        fields: ['id_usuario'],
        type: 'foreign key',
        name: 'fk_refresh_tokens_usuario',
        references: {
          table: 'tbl_usuario',
          field: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      });
    } catch (e) {}

    try {
      await queryInterface.addConstraint('refresh_tokens', {
        fields: ['id_aplicacao'],
        type: 'foreign key',
        name: 'fk_refresh_tokens_aplicacao',
        references: {
          table: 'dim_aplicacao',
          field: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      });
    } catch (e) {}

    try {
      await queryInterface.addConstraint('authorization_codes', {
        fields: ['id_usuario'],
        type: 'foreign key',
        name: 'fk_authcodes_usuario',
        references: {
          table: 'tbl_usuario',
          field: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      });
    } catch (e) {}

    try {
      await queryInterface.addConstraint('authorization_codes', {
        fields: ['id_aplicacao'],
        type: 'foreign key',
        name: 'fk_authcodes_aplicacao',
        references: {
          table: 'dim_aplicacao',
          field: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      });
    } catch (e) {}
  },

  async down(queryInterface, Sequelize) {
    // Drop newly created tables and remove added columns
    try {
      await queryInterface.dropTable('authorization_codes');
    } catch (e) {}

    try {
      await queryInterface.dropTable('refresh_tokens');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('dim_aplicacao', 'allowed_origins');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('dim_aplicacao', 'redirect_uris');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('dim_aplicacao', 'client_secret');
    } catch (e) {}

    try {
      await queryInterface.removeColumn('dim_aplicacao', 'client_id');
    } catch (e) {}
  },
};
