import { Construct } from 'constructs';
import * as cdk8s from 'cdk8s';
import * as k8s from 'cdk8s-plus';

export class Homework extends cdk8s.Chart {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    const dbSecret = new k8s.Secret(this, 'DbSecret', {
      metadata: {
        name: 'db-secret',
      },
      stringData: {
        MYSQL_DATABASE: 'wordpress',
        MYSQL_USER: 'wordpress',
        MYSQL_PASSWORD: 'sserpdrow',
        MYSQL_ROOT_PASSWORD: 'wqpejmo3n cpmo248',
      },
    });

    const db = new k8s.Deployment(this, 'Database', {
      metadata: {
        name: 'mysql-deployment'
      },
      containers: [
        new k8s.Container({
          image: 'mysql:5.7.31',
          env: {
            MYSQL_DATABASE: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_DATABASE'),
            MYSQL_USER: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_USER'),
            MYSQL_PASSWORD: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_PASSWORD'),
            MYSQL_ROOT_PASSWORD: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_ROOT_PASSWORD'),
          },
        }),
      ],
    });

    const dbService = new k8s.Service(this, 'DatabaseService', {
      metadata: {
        name: 'mysql-service',
      },
      type: k8s.ServiceType.CLUSTER_IP,
    });
    dbService.addDeployment(db, 3306);

    const wordpress = new k8s.Deployment(this, 'Wordpress', {
      metadata: {
        name: 'wordpress-deployment'
      },
      containers: [
        new k8s.Container({
          image: 'wordpress:php7.2',
          env: {
            WORDPRESS_DB_HOST: k8s.EnvValue.fromValue(dbService.name),
            WORDPRESS_DB_USER: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_USER'),
            WORDPRESS_DB_PASSWORD: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_PASSWORD'),
            WORDPRESS_DB_NAME: k8s.EnvValue.fromSecret(dbSecret, 'MYSQL_DATABASE'),
          },
        }),
      ],
    });
    
    const wordpressService = new k8s.Service(this, 'WordpressService', {
      metadata: {
        name: 'wordpress-service',
      },
      type: k8s.ServiceType.CLUSTER_IP,
    });
    wordpressService.addDeployment(wordpress, 80);

    const nginxConfing = new k8s.ConfigMap(this, 'NginxConf', {
      metadata: {
        name: 'nginx-conf',
      }
    });
    nginxConfing.addFile(`${__dirname}/asset/default.conf`, 'default.conf');
    
    const configVolume = k8s.Volume.fromConfigMap(nginxConfing, {
      name: `nginx-conf`,
      items: {
        'default.conf': {
          path: 'default.conf',
        },
      },
    });

    const logVolume = k8s.Volume.fromEmptyDir('log');

    const nginx = new k8s.Deployment(this, 'Nginx', {
      metadata: {
        name: 'nginx',
      },
      containers: [
        new k8s.Container({
          name: `main`,
          image: `nginx:stable`,
          volumeMounts: [
            {
              path: '/etc/nginx/conf.d',
              volume: configVolume,
              readOnly: true,
            },
            {
              path: '/var/log/nginx/pod-log-dir',
              volume: logVolume,
            },
          ],
        }),
        new k8s.Container({
          name: `logger`,
          image: `fluent/fluentd:v1.9-1`,
        }),
      ],
    });

    const nginxService = new k8s.Service(this, 'NginxService', {
      metadata: {
        name: 'nginx-service'
      },
      type: k8s.ServiceType.LOAD_BALANCER,
    });
    nginxService.addDeployment(nginx, 80);

    new k8s.Ingress(this, 'Ingress', {
      metadata: {
        name: 'ingress',
      },
      defaultBackend: k8s.IngressBackend.fromService(nginxService),
    });
  }
}

const app = new cdk8s.App();
new Homework(app, 'blog');
app.synth();
