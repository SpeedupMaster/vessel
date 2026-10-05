import React, { useState, useEffect } from 'react';
import {
  ArrowsClockwise,
  Eye,
  EyeSlash,
  Check,
  X,
  CircleNotch,
} from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';

export type DatabaseType = 'postgres' | 'mongodb' | 'mariadb' | 'mysql' | 'redis' | 'libsql';

interface DatabaseOption {
  type: DatabaseType;
  label: string;
  defaultImage: string;
  defaultUser?: string;
  defaultDbName?: string;
  hasUserAndDb: boolean;
  icon: React.ReactNode;
}

const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    type: 'postgres',
    label: 'PostgreSQL',
    defaultImage: 'postgres:16-alpine',
    defaultUser: 'postgres',
    defaultDbName: 'postgres',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 2C8.82 2 3 7.82 3 15c0 2.65.79 5.11 2.15 7.17L3.5 28.5l6.58-1.78C11.96 27.5 13.93 28 16 28c7.18 0 13-5.82 13-13S23.18 2 16 2z"
          fill="#DCE5EE"
          className="dark:fill-[#202c38]"
        />
        <path
          d="M22 10.5h-1.5c-.8-1.5-2.2-2.5-4.5-2.5-4.4 0-8 3.6-8 8s3.6 8 8 8c3.5 0 6.2-2.2 7.2-5.5"
          stroke="#2B5D88"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="dark:stroke-[#5b96c7]"
        />
        <circle cx="12.5" cy="13.5" r="1.6" fill="#2B5D88" className="dark:fill-[#5b96c7]" />
        <circle cx="18.5" cy="13.5" r="1.6" fill="#2B5D88" className="dark:fill-[#5b96c7]" />
        <path
          d="M11 18h4c.8 0 1.5-.7 1.5-1.5"
          stroke="#2B5D88"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="dark:stroke-[#5b96c7]"
        />
        <path
          d="M11 20.5c2 2.2 5.5 2.2 7.5 0"
          stroke="#2B5D88"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="dark:stroke-[#5b96c7]"
        />
      </svg>
    ),
  },
  {
    type: 'mongodb',
    label: 'MongoDB',
    defaultImage: 'mongo:7',
    defaultUser: 'mongo',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 2.5C15 4.5 8 11.5 8 17.5c0 5 3.5 8.8 8 10.2V2.5z"
          fill="#13AA52"
        />
        <path
          d="M16 2.5v25.2c4.5-1.4 8-5.2 8-10.2 0-6-7-13-8-15z"
          fill="#116149"
          className="dark:fill-[#0c4736]"
        />
        <path
          d="M15.2 27.7h1.6v2l-.8.8-.8-.8v-2z"
          fill="#13AA52"
        />
      </svg>
    ),
  },
  {
    type: 'mariadb',
    label: 'MariaDB',
    defaultImage: 'mariadb:11',
    defaultUser: 'mariadb',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path
          d="M4 20c3 3 10 4 18 2.5 3-.6 5-1.5 6-2.5-2 1.5-5.5 2.5-11 2.5-5.5 0-10-1-13-2.5z"
          fill="#D0D7DE"
          opacity="0.7"
          className="dark:fill-[#38424d] dark:opacity-80"
        />
        <path
          d="M20 14c1.5-3.5 3.5-6.5 5-7.5-1.2 3.5-1.5 6-1 8.5 1.5-1.5 2.5-3 3-4-.5 3-1.8 5.5-3.5 7.5 2 0 4 .5 5.5 1.5-2.5 2-6.5 2.5-10.5 2 2-1 4-1.5 6.5-1.5-2.5-1.5-4-3.5-5-6.5z"
          fill="#8B949E"
        />
        <path
          d="M4 15.5c0-4.8 3.5-8.5 8.5-8.5 6.2 0 10.5 4.5 11 9.5 0 3.8-3.2 5.5-7.5 5.5-5 0-12-1.5-12-6.5z"
          fill="#003545"
          className="dark:fill-[#0d4f63]"
        />
        <circle cx="8" cy="11" r="1.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    type: 'mysql',
    label: 'MySQL',
    defaultImage: 'mysql:8.4',
    defaultUser: 'root',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path
          d="M24 10.5c-1.8-3.5-5.4-6-9.5-6-6.1 0-11 4.9-11 11s4.9 11 11 11c5.2 0 9.6-3.6 10.7-8.5"
          stroke="#00758F"
          strokeWidth="3.4"
          strokeLinecap="round"
          className="dark:stroke-[#0296b8]"
        />
        <path d="M23.5 9.5l6.5-3.5-2.8 7-3.7-3.5z" fill="#F29111" />
        <circle cx="9.5" cy="12.5" r="1.6" fill="#F29111" />
      </svg>
    ),
  },
  {
    type: 'redis',
    label: 'Redis',
    defaultImage: 'redis:7-alpine',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path d="M16 2.5L27 8.2 16 13.9 5 8.2 16 2.5z" fill="#DC382D" />
        <path d="M5 8.5l11 5.7v3.2L5 11.7V8.5z" fill="#C62828" />
        <path d="M16 14.2l11-5.7v3.2l-11 5.7v-3.2z" fill="#B71C1C" />
        <path d="M5 14.2l11 5.7v3.2L5 17.4v-3.2z" fill="#B71C1C" />
        <path d="M16 19.9l11-5.7v3.2l-11 5.7v-3.2z" fill="#8E1B1B" />
        <path d="M5 19.9l11 5.7v3.2L5 23.1v-3.2z" fill="#8E1B1B" />
        <path d="M16 25.6l11-5.7v3.2l-11 5.7v-3.2z" fill="#600E0E" />
      </svg>
    ),
  },
  {
    type: 'libsql',
    label: 'libSQL',
    defaultImage: 'ghcr.io/tursodatabase/libsql-server:latest',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path
          d="M5.5 24.5l3.2-3.2c3.5-3.5 7.5-9.5 15.3-15.3-3.2 6.5-8.5 13-14 17l-4.5 1.5z"
          fill="#80F5DA"
          opacity="0.75"
        />
        <path
          d="M5 25l3-3c3.5-3.5 7-8.5 14-13.5-3.5 5.5-7.5 10.5-12 14.5l-3 3-2-1z"
          fill="#00D2B4"
        />
      </svg>
    ),
  },
];

function generateSecurePassword(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDatabase: (appData: Partial<AppItem>) => Promise<any>;
}

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onCreateDatabase,
}) => {
  const [selectedType, setSelectedType] = useState<DatabaseType>('postgres');
  const [name, setName] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dockerImage, setDockerImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentOption = DATABASE_OPTIONS.find((o) => o.type === selectedType) || DATABASE_OPTIONS[0];

  // Initialize or reset defaults when switching database type
  useEffect(() => {
    if (isOpen) {
      setDbPassword(generateSecurePassword(20));
      setName(`${selectedType}-db`);
      if (currentOption.hasUserAndDb) {
        setDbName(currentOption.defaultDbName || 'app_db');
        setDbUser(currentOption.defaultUser || 'root');
      } else {
        setDbName('');
        setDbUser('');
      }
      setDockerImage('');
      setError(null);
    }
  }, [selectedType, isOpen]);

  const handleSelectType = (type: DatabaseType) => {
    setSelectedType(type);
  };

  const handleGeneratePassword = () => {
    setDbPassword(generateSecurePassword(20));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入数据库实例名称 (Name)');
      return;
    }
    if (!dbPassword.trim()) {
      setError('请输入或生成数据库访问密码');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const imageToUse = dockerImage.trim() || currentOption.defaultImage;
    const finalDbName = dbName.trim() || currentOption.defaultDbName || 'app_db';
    const finalDbUser = dbUser.trim() || currentOption.defaultUser || 'root';

    // Assemble Docker Compose YAML and .env
    let composeYaml = '';
    let envContent = '';

    switch (selectedType) {
      case 'postgres':
        composeYaml = `services:
  database:
    image: \${POSTGRES_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${finalDbName}}
      POSTGRES_USER: \${POSTGRES_USER:-${finalDbUser}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - ./data:/var/lib/postgresql/data
`;
        envContent = `POSTGRES_IMAGE=${imageToUse}
POSTGRES_DB=${finalDbName}
POSTGRES_USER=${finalDbUser}
POSTGRES_PASSWORD=${dbPassword}
`;
        break;

      case 'mongodb':
        composeYaml = `services:
  database:
    image: \${MONGO_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: \${MONGO_INITDB_DATABASE:-${finalDbName}}
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_INITDB_ROOT_USERNAME:-${finalDbUser}}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_INITDB_ROOT_PASSWORD}
    volumes:
      - ./data:/data/db
`;
        envContent = `MONGO_IMAGE=${imageToUse}
MONGO_INITDB_DATABASE=${finalDbName}
MONGO_INITDB_ROOT_USERNAME=${finalDbUser}
MONGO_INITDB_ROOT_PASSWORD=${dbPassword}
`;
        break;

      case 'mariadb':
        composeYaml = `services:
  database:
    image: \${MARIADB_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MARIADB_DATABASE: \${MARIADB_DATABASE:-${finalDbName}}
      MARIADB_USER: \${MARIADB_USER:-${finalDbUser}}
      MARIADB_PASSWORD: \${MARIADB_PASSWORD}
      MARIADB_ROOT_PASSWORD: \${MARIADB_ROOT_PASSWORD}
    volumes:
      - ./data:/var/lib/mysql
`;
        envContent = `MARIADB_IMAGE=${imageToUse}
MARIADB_DATABASE=${finalDbName}
MARIADB_USER=${finalDbUser}
MARIADB_PASSWORD=${dbPassword}
MARIADB_ROOT_PASSWORD=${dbPassword}
`;
        break;

      case 'mysql':
        composeYaml = `services:
  database:
    image: \${MYSQL_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_DATABASE: \${MYSQL_DATABASE:-${finalDbName}}
      MYSQL_USER: \${MYSQL_USER:-${finalDbUser}}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
    volumes:
      - ./data:/var/lib/mysql
`;
        envContent = `MYSQL_IMAGE=${imageToUse}
MYSQL_DATABASE=${finalDbName}
MYSQL_USER=${finalDbUser}
MYSQL_PASSWORD=${dbPassword}
MYSQL_ROOT_PASSWORD=${dbPassword}
`;
        break;

      case 'redis':
        composeYaml = `services:
  database:
    image: \${REDIS_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --requirepass \${REDIS_PASSWORD}
    volumes:
      - ./data:/data
`;
        envContent = `REDIS_IMAGE=${imageToUse}
REDIS_PASSWORD=${dbPassword}
`;
        break;

      case 'libsql':
        composeYaml = `services:
  database:
    image: \${LIBSQL_IMAGE:-${imageToUse}}
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      SQLD_AUTH_TOKEN: \${SQLD_AUTH_TOKEN}
    volumes:
      - ./data:/var/lib/sqld
`;
        envContent = `LIBSQL_IMAGE=${imageToUse}
SQLD_AUTH_TOKEN=${dbPassword}
`;
        break;
    }

    try {
      await onCreateDatabase({
        name: name.trim(),
        description: `Managed ${currentOption.label} Database Service`,
        composeYaml,
        envContent,
        autoUpdate: false,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '创建数据库失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Databases"
      subtitle="Select a database"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-1 font-sans text-xs">
        {/* Database Selection Grid (2x3) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DATABASE_OPTIONS.map((db) => {
            const isSelected = selectedType === db.type;
            return (
              <button
                key={db.type}
                type="button"
                onClick={() => handleSelectType(db.type)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-accent dark:border-accent bg-paper dark:bg-white/[0.04] shadow-sm ring-1 ring-accent'
                    : 'border-line hover:border-line-hover bg-paper-2 dark:bg-[#16161b]'
                }`}
              >
                <div className="mb-2.5 flex items-center justify-center">{db.icon}</div>
                <span className="text-xs font-semibold text-ink">{db.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Fields Section */}
        <div className="space-y-4 pt-2 border-t border-line/60">
          <h4 className="text-sm font-semibold text-ink tracking-tight">Fill the next fields.</h4>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Database Name (if applicable) */}
          {currentOption.hasUserAndDb && (
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Database Name</label>
              <input
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="Database Name"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Database User (if applicable) */}
          {currentOption.hasUserAndDb && (
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Database User</label>
              <input
                type="text"
                value={dbUser}
                onChange={(e) => setDbUser(e.target.value)}
                placeholder={`Default ${currentOption.defaultUser}`}
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Database Password */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Database Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="Database Password"
                className="w-full bg-paper border border-line rounded-lg pl-3.5 pr-20 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1 text-ink-muted">
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="p-1 hover:text-ink hover:bg-paper-3 rounded transition-colors cursor-pointer"
                  title="重新随机生成安全密码"
                >
                  <ArrowsClockwise className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:text-ink hover:bg-paper-3 rounded transition-colors cursor-pointer"
                  title={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Docker image */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Docker image</label>
            <input
              type="text"
              value={dockerImage}
              onChange={(e) => setDockerImage(e.target.value)}
              placeholder={`Default ${currentOption.defaultImage}`}
              className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none font-mono transition-colors"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-line/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
