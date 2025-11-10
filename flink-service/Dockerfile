FROM flink:1.17.1

USER root
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-dev curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install apache-flink==1.17.1 cassandra-driver

COPY jars/*.jar /opt/flink/lib/

USER flink
