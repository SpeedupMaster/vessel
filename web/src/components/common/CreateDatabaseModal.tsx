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
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 4C14.06 4 6 12.06 6 22c0 6.64 3.6 12.44 8.95 15.61L14 44l8.32-3.12C23.09 40.95 23.54 41 24 41c9.94 0 18-8.06 18-18S33.94 4 24 4z"
          fill="#336791"
          opacity="0.15"
        />
        <path
          d="M32 20c-1-3-3.8-5-7.5-5-4.5 0-8 3-8 8 0 4 2.5 7.5 7 8 2.5.3 4.8-.8 6.2-2.7.4-.5 1.1-.6 1.6-.2.5.4.6 1.1.2 1.6-1.9 2.5-4.9 3.8-8.2 3.4-5.6-.6-8.8-5-8.8-10.1 0-6.2 4.4-10 10-10 4.6 0 8.2 2.5 9.4 6.2.2.6-.1 1.2-.7 1.5-.6.2-1.2-.1-1.2-.7z"
          fill="#336791"
        />
        <circle cx="21" cy="22" r="2" fill="#336791" />
        <circle cx="29" cy="22" r="2" fill="#336791" />
        <path d="M25 27c0 1.5-1.5 2.5-3 2.5s-3-1-3-2.5" stroke="#336791" strokeWidth="2" strokeLinecap="round" />
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
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 4c-1 3-9 12-9 22 0 7.5 4 14 9 18 5-4 9-10.5 9-18 0-10-8-19-9-22z"
          fill="#13AA52"
          opacity="0.2"
        />
        <path
          d="M24 5c-.3 1-8.5 11.2-8.5 21 0 7 3.8 13.2 8.5 17V5z"
          fill="#13AA52"
        />
        <path
          d="M24 5v38c4.7-3.8 8.5-10 8.5-17 0-9.8-8.2-20-8.5-21z"
          fill="#116149"
        />
        <path
          d="M23.5 43v2h1v-2h-1z"
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
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M38 28c-2-6-7-10-14-10-5 0-9 2-12 5-3 3-4 8-4 13 0 2 1 4 3 5 4 2 9 3 14 3 8 0 14-3 17-9 1-2 1-5-4-7z"
          fill="#8B949E"
          opacity="0.2"
        />
        <path
          d="M10 26c2-4 6-7 11-7 7 0 12 5 13 11 1 3 0 6-3 7-4 2-9 2-14 1-5-1-8-3-8-6 0-2 .4-4 1-6z"
          fill="#003545"
          className="dark:fill-slate-300"
        />
        <circle cx="16" cy="24" r="1.5" fill="#C0C0C0" />
        <path d="M34 22c3-1 6-3 8-6-1 4-3 7-5 9" stroke="#8B949E" strokeWidth="2" strokeLinecap="round" />
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
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M36 18c-3-5-9-8-15-8-8 0-14 5-15 13 0 4 2 8 5 11 4 4 10 5 16 4 5-1 9-4 12-8l-4-3c-2 3-5 5-9 6-5 1-9 0-12-3-2-2-3-5-3-8 1-6 5-9 11-9 4 0 8 2 10 5l4-3z"
          fill="#00758F"
        />
        <path
          d="M34 16c2-2 5-4 9-4-1 3-3 6-5 8-1-1-2-2-4-4z"
          fill="#F29111"
        />
        <circle cx="16" cy="20" r="1.5" fill="#F29111" />
      </svg>
    ),
  },
  {
    type: 'redis',
    label: 'Redis',
    defaultImage: 'redis:7-alpine',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M24 6L8 14l16 8 16-8L24 6z"
          fill="#DC382D"
        />
        <path
          d="M8 18l16 8 16-8v6l-16 8-16-8v-6z"
          fill="#A8231B"
        />
        <path
          d="M8 28l16 8 16-8v6l-16 8-16-8v-6z"
          fill="#78140E"
        />
      </svg>
    ),
  },
  {
    type: 'libsql',
    label: 'libSQL',
    defaultImage: 'ghcr.io/tursodatabase/libsql-server:latest',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
        <path
          d="M12 36C12 24 22 12 36 8c-3 10-10 18-20 23-1.5.8-3 2.5-4 5z"
          fill="#00D2B4"
          opacity="0.2"
        />
        <path
          d="M14 34c1-9 8-18 20-22-3 8-8 15-16 19-1.2.6-2.5 1.8-4 3z"
          fill="#00D2B4"
        />
        <path
          d="M10 38l6-6"
          stroke="#00D2B4"
          strokeWidth="3"
          strokeLinecap="round"
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
