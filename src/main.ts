import { Construct } from 'constructs';
import * as cdk8s from 'cdk8s';
import * as kplus from 'cdk8s-plus';

export class Homework extends cdk8s.Chart {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    // Defines nginx config
    const nginxConf = new kplus.ConfigMap(this, 'NginxConf', {
      metadata: {
        name: 'nginx-conf',
      },
    });
    nginxConf.addFile(`${__dirname}/asset/nginx.conf`, 'default.conf');
    
    // Defines nginx config volume
    const nginxConfigVolume = kplus.Volume.fromConfigMap(nginxConf, {
      name: `nginx-conf`,
      items: {
        'default.conf': {
          path: 'default.conf',
        },
      },
    });
    
    // Defines fluentd config
    const fluentdConf = new kplus.ConfigMap(this, 'FluentdConf', {
      metadata: {
        name: 'fluentd-conf'
      },
    });
    fluentdConf.addFile(`${__dirname}/asset/fluentd.conf`, 'fluent.conf');

    // Defines fluentd config volume
    const fluentdConfingVolume = kplus.Volume.fromConfigMap(fluentdConf, {
      name: `fluentd-conf`,
      items: {
        'fluent.conf': {
          path: 'fluent.conf',
        },
      },
    });


    // Defines log volume
    const logVolume = kplus.Volume.fromEmptyDir('log');

    // Defines database secret
    const dbSecret = new kplus.Secret(this, 'DbSecret', {
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
    
    // Setup database
    const db = new kplus.Service(this, 'DatabaseService', {
      metadata: {
        name: 'mysql-service',
      },
      type: kplus.ServiceType.CLUSTER_IP,
    });
    db.addDeployment(new kplus.Deployment(this, 'Database', {
      metadata: {
        name: 'mysql-deployment'
      },
      containers: [
        new kplus.Container({
          image: 'mysql:5.7.31',
          env: {
            MYSQL_DATABASE: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_DATABASE'),
            MYSQL_USER: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_USER'),
            MYSQL_PASSWORD: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_PASSWORD'),
            MYSQL_ROOT_PASSWORD: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_ROOT_PASSWORD'),
          },
        }),
      ],
    }), 3306);
    

    // Setup wordpress
    const wordpress = new kplus.Service(this, 'WordpressService', {
      metadata: {
        name: 'wordpress-service',
      },
      type: kplus.ServiceType.CLUSTER_IP,
    });
    wordpress.addDeployment(new kplus.Deployment(this, 'Wordpress', {
      metadata: {
        name: 'wordpress-deployment'
      },
      containers: [
        new kplus.Container({
          image: 'wordpress:php7.2',
          env: {
            WORDPRESS_DB_HOST: kplus.EnvValue.fromValue(db.name),
            WORDPRESS_DB_USER: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_USER'),
            WORDPRESS_DB_PASSWORD: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_PASSWORD'),
            WORDPRESS_DB_NAME: kplus.EnvValue.fromSecret(dbSecret, 'MYSQL_DATABASE'),
          },
        }),
      ],
    }), 80);

    // Setup nginx
    const nginx = new kplus.Service(this, 'NginxService', {
      metadata: {
        name: 'nginx-service'
      },
      type: kplus.ServiceType.LOAD_BALANCER,
    });
    nginx.addDeployment(new kplus.Deployment(this, 'Nginx', {
      metadata: {
        name: 'nginx',
      },
      containers: [
        new kplus.Container({
          name: `main`,
          image: `nginx:stable`,
          volumeMounts: [
            {
              path: '/etc/nginx/conf.d',
              volume: nginxConfigVolume,
              readOnly: true,
            },
            {
              path: '/var/log/nginx/pod-log-dir',
              volume: logVolume,
            },
          ],
        }),
        new kplus.Container({
          name: `logger`,
          image: `fluent/fluentd:v1.9-1`,
          volumeMounts: [
            {
              path: '/fluentd/etc',
              volume: fluentdConfingVolume,
              readOnly: true,
            },
          ]
        }),
      ],
    }), 80);
    
    // Setup ingress to nginx
    new kplus.Ingress(this, 'Ingress', {
      metadata: {
        name: 'ingress',
      },
      defaultBackend: kplus.IngressBackend.fromService(nginx),
    });
  }
}

const app = new cdk8s.App();
new Homework(app, 'blog');
app.synth();
