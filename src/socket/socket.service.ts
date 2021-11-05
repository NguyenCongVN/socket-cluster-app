import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClient } from 'redis';

import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService implements OnModuleInit, OnModuleDestroy {
  public redisClient: RedisClient;
  public publisherClient: RedisClient;
  private subscriberClient: RedisClient;
  private discoveryInterval;
  private serviceId: string;

  constructor(private readonly socketGateway: SocketGateway) {
    this.serviceId = 'SOCKET_CHANNEL_' + Math.random()
      .toString(26)
      .slice(2);

      setInterval(() => {
        this.sendMessage(
          'user1',
          new Date().toLocaleTimeString() +
            ` | from server on port ${process.env['PORT']}`,
          false,
        );
      }, 3000);
  }

  async onModuleInit() {

    // Redis client cập nhật service key bằng channel discovery
    this.redisClient = await this.newRedisClient();
    // subcriber client nhận message
    this.subscriberClient = await this.newRedisClient();
    // publisherClient gửi đi message
    this.publisherClient = await this.newRedisClient();

    this.subscriberClient.subscribe(this.serviceId);

    this.subscriberClient.on('message', (channel, message) => {
      const { userId, payload } = JSON.parse(message);
      this.sendMessage(userId, payload, true);
    });

    await this.channelDiscovery();
  }
  
  // Tạo redis instance
  private async newRedisClient() {
    return createClient({
      host: 'localhost',
      port: 30466,
    });
  }

  async onModuleDestroy() {
    this.discoveryInterval && clearTimeout(this.discoveryInterval);
  }

  private async channelDiscovery() {
    this.redisClient.setex(this.serviceId, 3, Date.now().toString());
    this.discoveryInterval = setTimeout(() => {
      this.channelDiscovery();
    }, 2000);
  }

  /**
   * Gửi message đến một client có mã userId và xem có đến từ redis hay không
   * @param userId 
   * @param payload 
   * @param fromRedisChannel 
   */
  async sendMessage(
    userId: string,
    payload: string,
    fromRedisChannel: boolean,
  ) {
    // Gửi tới tất cả các thiết bị gắn với một userId
    this.socketGateway.connectedSockets[userId]?.forEach(socket =>
      socket.send(payload),
    );

    // Nếu không từ redis channel mà từ client thì
    // sẽ gửi tới tất cả các service khác để kiểm tra xem có client id ứng với id hiện tại không
    if (!fromRedisChannel) {
      // Tìm tất cả các channel và gửi payload tới đó
      this.redisClient.keys('SOCKET_CHANNEL_*', (err, ids) => {
        ids
          .filter(p => p != this.serviceId)
          .forEach(id => {
            this.publisherClient.publish(
              id,
              JSON.stringify({
                payload,
                userId,
              }),
            );
          });
      });
    }
  }
}
